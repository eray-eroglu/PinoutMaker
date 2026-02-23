import { useState, useRef, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { CanvasStage } from './components/CanvasStage';
import type { PinData, ProjectData } from './types';
import jsPDF from 'jspdf';
import Konva from 'konva';

function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [pins, setPins] = useState<PinData[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [imageRotation, setImageRotation] = useState(0);
  const [isAddingPin, setIsAddingPin] = useState(false);
  
  // Lifted state for CanvasStage
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const stageRef = useRef<Konva.Stage>(null);
  const copiedPinRef = useRef<PinData | null>(null); // For Ctrl+C/V

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const img = new Image();
      img.src = result;
      img.onload = () => {
        setImage(img);
        setImageRotation(0);
      };
    };
    reader.readAsDataURL(file);
  };

  const handleRotateImage = () => {
    setImageRotation((prev) => (prev + 90) % 360);
  };

  const toggleAddPinMode = () => {
    setIsAddingPin(!isAddingPin);
    setSelectedPinId(null);
  };

  const createPinAt = (x: number, y: number) => {
    // Click position is the "Target" (Anchor point on the board)
    // Label box placed slightly to the right, centered vertically relative to target
    
    // Constant VISUAL offsets (in screen pixels)
    // We divide by scale to get the correct canvas coordinate distance
    const visualOffsetX = 50; 
    const visualOffsetY = -13; // Centering approx 26px high box

    const newPin: PinData = {
      id: crypto.randomUUID(),
      x: x + (visualOffsetX / scale),
      y: y + (visualOffsetY / scale),
      targetX: x,
      targetY: y,
      text: 'New Pin',
      color: '#ef4444', // red-500
      isPwm: false,
    };
    setPins([...pins, newPin]);
    setSelectedPinId(newPin.id);
    setIsAddingPin(false);
  };

  const updatePin = (updatedPin: PinData) => {
    setPins(pins.map((pin) => (pin.id === updatedPin.id ? updatedPin : pin)));
  };

  const deletePin = () => {
    if (selectedPinId) {
      setPins(pins.filter((pin) => pin.id !== selectedPinId));
      setSelectedPinId(null);
    }
  };

  const selectPin = (id: string | null) => {
    setSelectedPinId(id);
  };

  const selectedPin = pins.find((p) => p.id === selectedPinId) || null;

  // Handle Ctrl+C / Ctrl+V
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const activeElement = document.activeElement as HTMLElement | null;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable)
      ) {
        return;
      }

      // Copy (Ctrl+C or Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const pinToCopy = pins.find(p => p.id === selectedPinId);
        if (pinToCopy) {
          copiedPinRef.current = { ...pinToCopy }; // Deep copy not needed if object is flat, but spread is good
          console.log('Copied pin:', pinToCopy.id);
        }
      }

      // Paste (Ctrl+V or Cmd+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedPinRef.current) {
          const original = copiedPinRef.current;
          
          // Generate new ID
          const newId = crypto.randomUUID();

          // Create new pin with offset (20px down-right) relative to the LAST copied/pasted pin
          const newPin: PinData = {
            ...original,
            id: newId,
            x: original.x + 20,
            y: original.y + 20,
            targetX: original.targetX + 20,
            targetY: original.targetY + 20,
            text: original.text, // Keep same name for bulk creation
          };

          setPins((prevPins) => [...prevPins, newPin]);
          setSelectedPinId(newId);
          
          // Update clipboard to the new pin so the next paste chains from this one
          copiedPinRef.current = newPin;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPinId, pins]);

  const handleSaveProject = async () => {
    if (!window.electronAPI) return;
    
    // Convert current image to base64 if it exists
    let imageData = '';
    if (image) {
      imageData = image.src; 
    }

    const projectData: ProjectData = {
      image: imageData,
      pins,
      rotation: imageRotation,
      scale,
      position
    };

    const json = JSON.stringify(projectData, null, 2);
    await window.electronAPI.saveFile(json);
  };

  const handleLoadProject = async () => {
    if (!window.electronAPI) return;
    
    const json = await window.electronAPI.loadFile();
    if (!json) return;

    try {
      const data: ProjectData = JSON.parse(json);
      
      if (data.image) {
        const img = new Image();
        img.src = data.image;
        img.onload = () => setImage(img);
      } else {
        setImage(null);
      }

      setPins(data.pins || []);
      setImageRotation(data.rotation || 0);
      setScale(data.scale || 1);
      setPosition(data.position || { x: 0, y: 0 });
      
    } catch (e) {
      console.error("Failed to parse project file", e);
      alert("Invalid project file");
    }
  };

  const handleExportPdf = async () => {
    if (!stageRef.current) return;
    
    const stage = stageRef.current;
    
    // Save current scale/pos to restore later
    const oldScale = stage.scaleX();
    const oldPos = stage.position();
    
    // 1. Calculate Bounding Box of the "Virtual Scene"
    //    We want to export everything (Image + Pins), regardless of current zoom/pan.
    
    // Initialize with extreme values inverted
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    let hasContent = false;

    // Consider Image Bounds
    if (image) {
        hasContent = true;
        // Image is drawn at (0,0) but offset by (w/2, h/2). 
        // effectively centering it at 0,0 in world space.
        // Rotation happens around that center.
        // The max extent of a rotated rectangle centered at 0,0 is its radius.
        const w = image.width;
        const h = image.height;
        const radius = Math.sqrt(w*w + h*h) / 2;
        
        // Safe bounding box for any rotation
        minX = -radius;
        maxX = radius;
        minY = -radius;
        maxY = radius;
    }
    
    // Consider Pins
    if (pins.length > 0) {
        hasContent = true;
        pins.forEach(p => {
             // Check anchor point
             if (p.targetX < minX) minX = p.targetX;
             if (p.targetX > maxX) maxX = p.targetX;
             if (p.targetY < minY) minY = p.targetY;
             if (p.targetY > maxY) maxY = p.targetY;

             // Check label position (approximate box)
             // Label is centered-ish or just check x,y
             // Label width is variable, let's assume ~150px safe width and ~40px height
             // It's better to overestimate than cut off.
             const labelL = p.x; 
             const labelR = p.x + 100; // rough width
             const labelT = p.y;
             const labelB = p.y + 30; // rough height

             if (labelL < minX) minX = labelL;
             if (labelR > maxX) maxX = labelR;
             if (labelT < minY) minY = labelT;
             if (labelB > maxY) maxY = labelB;
        });
    }

    if (!hasContent) {
        alert("Nothing to export!");
        return;
    }

    // Add Padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    let bgRect: Konva.Rect | null = null;
    let gridLayer: Konva.Layer | undefined;

    try {
        // 2. Adjust Stage to fit content exactly into the viewport 
        
        stage.scale({ x: 1, y: 1 });
        stage.position({ x: -minX, y: -minY });
        
        // Hide grid layer
        gridLayer = stage.findOne('.grid-layer') as Konva.Layer | undefined;
        if (gridLayer) gridLayer.hide();

        // Add white background
        // We can create a temporary Rectangle on the content layer bottom
        const contentLayer = stage.findOne('.content-layer') as Konva.Layer | undefined;
        
        if (contentLayer) {
            bgRect = new Konva.Rect({
                x: minX,
                y: minY,
                width: contentWidth,
                height: contentHeight,
                fill: 'white',
                listening: false
            });
            contentLayer.add(bgRect);
            bgRect.moveToBottom();
        }

        const dataUrl = stage.toDataURL({
            pixelRatio: 2, 
            x: 0,
            y: 0,
            width: contentWidth,
            height: contentHeight,
            mimeType: 'image/jpeg',
            quality: 0.90
        });

        // 3. Generate PDF
        const orientation = contentWidth > contentHeight ? 'l' : 'p';
        const pdf = new jsPDF(orientation, 'mm', 'a4');
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        const widthRatio = pageWidth / contentWidth;
        const heightRatio = pageHeight / contentHeight;
        const scaleFactor = Math.min(widthRatio, heightRatio);
        
        const printWidth = contentWidth * scaleFactor;
        const printHeight = contentHeight * scaleFactor;
        
        const marginX = (pageWidth - printWidth) / 2;
        const marginY = (pageHeight - printHeight) / 2;

        pdf.addImage(dataUrl, 'JPEG', marginX, marginY, printWidth, printHeight);

        const pdfBuffer = pdf.output('arraybuffer');
        
        if (window.electronAPI) {
            await window.electronAPI.savePdf(pdfBuffer);
        } else {
             pdf.save('pinout-diagram.pdf');
        }

    } catch (e) {
        console.error("PDF Export failed", e);
        alert("Failed to export PDF: " + (e as any).message);
    } finally {
        // Cleanup
        if (bgRect) {
            bgRect.destroy();
        }
        if (gridLayer) {
            gridLayer.show();
        }
        
        // 4. Restore Original View
        stage.scale({ x: oldScale, y: oldScale });
        stage.position(oldPos);
    }
  };

  return (
    <div className='h-screen w-screen flex flex-col overflow-hidden bg-white'>
      <TopBar
        onImport={handleImageUpload}
        onAddPin={toggleAddPinMode}
        onDeletePin={deletePin}
        onRotateImage={handleRotateImage}
        onSave={handleSaveProject}
        onLoad={handleLoadProject}
        onExportPdf={handleExportPdf}
        isPinSelected={!!selectedPinId}
        isImageLoaded={!!image}
        isAddingPin={isAddingPin}
      />
      <div className='flex flex-1 overflow-hidden'>
        <CanvasStage
          ref={stageRef}
          image={image}
          imageRotation={imageRotation}
          pins={pins}
          selectedPinId={selectedPinId}
          onSelectPin={selectPin}
          onUpdatePin={updatePin}
          isAddingPin={isAddingPin}
          onCreatePin={createPinAt}
          scale={scale}
          setScale={setScale}
          position={position}
          setPosition={setPosition}
        />
        <Sidebar selectedPin={selectedPin} onUpdatePin={updatePin} />
      </div>
    </div>
  );
}

export default App;
