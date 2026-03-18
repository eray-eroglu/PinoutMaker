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
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [gapSize, setGapSize] = useState<number>(12);
  
  // Lifted state for CanvasStage
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const stageRef = useRef<Konva.Stage>(null);
  const copiedPinRef = useRef<PinData | null>(null); // For Ctrl+C/V

  // Undo / Redo History
  const pastRef = useRef<PinData[][]>([]);
  const futureRef = useRef<PinData[][]>([]);

  const handlePushHistory = () => {
    pastRef.current.push([...pins]);
    futureRef.current = [];
  };

  const handleUndo = () => {
    if (pastRef.current.length === 0) return;
    setPins((currentPins) => {
      const prev = pastRef.current.pop()!;
      futureRef.current.push([...currentPins]);
      return prev;
    });
  };

  const handleRedo = () => {
    if (futureRef.current.length === 0) return;
    setPins((currentPins) => {
      const next = futureRef.current.pop()!;
      pastRef.current.push([...currentPins]);
      return next;
    });
  };

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
    setPins((prev) => {
      pastRef.current.push([...prev]);
      futureRef.current = [];
      return [...prev, newPin];
    });
    setSelectedPinId(newPin.id);
    setIsAddingPin(false);
  };

  const updatePin = (updatedPin: PinData, saveHistory = true) => {
    setPins((prevPins) => {
      if (saveHistory) {
        pastRef.current.push([...prevPins]);
        futureRef.current = [];
      }
      return prevPins.map((pin) => (pin.id === updatedPin.id ? updatedPin : pin));
    });
  };

  const deletePin = () => {
    if (selectedPinId) {
      setPins((prevPins) => {
        pastRef.current.push([...prevPins]);
        futureRef.current = [];
        return prevPins.filter((pin) => pin.id !== selectedPinId);
      });
      setSelectedPinId(null);
    }
  };

  const selectPin = (id: string | null) => {
    setSelectedPinId(id);
  };
  
  const handlePinDoubleClick = (id: string) => {
    // When double clicking a pin, we just want to ensure it is selected
    // so that the sidebar input becomes active.
    // We can also focus the sidebar input programmatically if needed.
    console.log("App: handlePinDoubleClick", id);
    setSelectedPinId(id);
    
    // Dispatch a custom event to focus the sidebar input
    window.dispatchEvent(new CustomEvent('focus-sidebar-input'));
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

      // Delete (Delete or Backspace)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPinId) {
          // If editing text in Sidebar, don't delete pin
          const activeElement = document.activeElement as HTMLElement | null;
          if (
            activeElement &&
            (activeElement.tagName === 'INPUT' ||
              activeElement.tagName === 'TEXTAREA' ||
              activeElement.isContentEditable)
          ) {
            return;
          }
          
          setPins((prevPins) => {
            pastRef.current.push([...prevPins]);
            futureRef.current = [];
            return prevPins.filter((p) => p.id !== selectedPinId);
          });
          setSelectedPinId(null);
        }
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

          setPins((prevPins) => {
            pastRef.current.push([...prevPins]);
            futureRef.current = [];
            return [...prevPins, newPin];
          });
          setSelectedPinId(newId);
          
          // Update clipboard to the new pin so the next paste chains from this one
          copiedPinRef.current = newPin;
        }
      }

      // Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
          return;
        }
        e.preventDefault();
        handleUndo();
      }

      // Redo (Ctrl+Y or Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
          return;
        }
        e.preventDefault();
        handleRedo();
      }
      // Save (Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleQuickSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPinId, pins, image, imageRotation, scale, position, currentFilePath]);

  const handleQuickSave = async () => {
    if (!window.electronAPI) return;
    
    let imageData = '';
    if (image) {
      imageData = image.src; 
    }

    const projectData: ProjectData = {
      image: imageData,
      pins,
      rotation: imageRotation,
      scale,
      position,
      gapSize
    };

    const json = JSON.stringify(projectData, null, 2);

    if (currentFilePath) {
      // Direct save
      const result = await window.electronAPI.saveFileDirect(currentFilePath, json);
      if (result.success) {
        console.log('Quick save successful');
      } else {
        alert('Failed to save file.');
      }
    } else {
      // Fallback to Save As
      const result = await window.electronAPI.saveFile(json);
      if (result.success && result.path) {
        setCurrentFilePath(result.path);
      }
    }
  };

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
      position,
      gapSize
    };

    const json = JSON.stringify(projectData, null, 2);
    const result = await window.electronAPI.saveFile(json);
    if (result.success && result.path) {
      setCurrentFilePath(result.path);
    }
  };

  const handleLoadProject = async () => {
    if (!window.electronAPI) return;
    
    const result = await window.electronAPI.loadFile();
    if (!result || !result.content) return;
    
    if (result.path) {
      setCurrentFilePath(result.path);
    }

    try {
      const data: ProjectData = JSON.parse(result.content);
      
      if (data.image) {
        const img = new Image();
        img.src = data.image;
        img.onload = () => setImage(img);
      } else {
        setImage(null);
      }

      // const migratedPins = (data.pins || []).map(pin => ({ ... }));

      setPins(data.pins || []);
      setImageRotation(data.rotation || 0);
      setScale(data.scale || 1);
      setPosition(data.position || { x: 0, y: 0 });
      setGapSize(data.gapSize ?? 12);
      
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
             // Label width is variable, but usually proportional to text length
             // We must account for the current scale, because labels are drawn with inverse scale
             // to remain constant size on screen.
             const invScale = 1 / scale;
             // Use stored width if available, otherwise estimate based on text length (approx 8px per char + padding)
             const textWidth = p.labelWidth || (Math.max(60, p.text.length * 8) + 20); 
             const estimatedWidth = textWidth * invScale;
             const estimatedHeight = (p.labelHeight || 40) * invScale;
             
             // PinComponent centers text sometimes? No, Label is top-left at x,y usually.
             // But let's check PinComponent alignment. It uses center alignment for text, 
             // but Label x,y is the top-left of the group usually? 
             // Wait, PinComponent uses x={currentLabelX} y={currentLabelY} for Label.
             // So x,y is top-left.
             
             const labelL = p.x; 
             const labelR = p.x + estimatedWidth; 
             const labelT = p.y;
             const labelB = p.y + estimatedHeight; 

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

    // Add Padding (Scale sensitive padding)
    // If zoomed out, padding needs to be larger to be visible
    const padding = 50 * (1/scale);
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const boardWidth = maxX - minX;
    
    // Scale legend based on board size so it's readable
    const legendScale = Math.max(1, boardWidth / 1000);
    const legendWidth = 200 * legendScale;
    const legendHeight = 350 * legendScale;

    // Place legend on the left side of the board
    const legendWorldX = minX - legendWidth - padding;
    const legendWorldY = minY;

    // Update minX to include the legend
    // The view will start from this new minX, so legend will be at (minX + padding, minY + padding) relative to view
    // Wait, we set stage position to (-minX, -minY).
    minX = legendWorldX - padding; 
    
    // Wait, if legend is taller than content, we might need to adjust maxY
    if (legendWorldY + legendHeight > maxY) {
        maxY = legendWorldY + legendHeight + padding;
    }

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

        // Temporarily render the Legend Panel into the Konva Stage for export
        // Since the legend is HTML, Konva doesn't see it. We must draw it manually.
        const legendGroup = new Konva.Group({
            x: legendWorldX,
            y: legendWorldY,
            scaleX: legendScale,
            scaleY: legendScale,
            id: 'temp-legend-export'
        });

        // Legend Background
        legendGroup.add(new Konva.Rect({
            x: 0, y: 0, width: 192, height: 340,
            fill: '#e6e6e6', stroke: '#d1d5db', strokeWidth: 1,
            cornerRadius: 4, shadowColor: 'black', shadowBlur: 4, shadowOpacity: 0.1
        }));

        // Legend Title
        legendGroup.add(new Konva.Text({
            x: 8, y: 8, text: 'TABLE', fontSize: 12, fontFamily: 'sans-serif', fill: '#4b5563'
        }));

        const legendItems = [
            { text: 'POWER', color: '#dc2626' },
            { text: 'GROUND', color: '#000000' },
            { text: 'PHYSICAL PIN', color: '#0d9488' },
            { text: 'CONTROL', color: '#ca8a04' },
            { text: 'ANALOG', color: '#16a34a' },
            { text: 'TIMER & CHANNEL', color: '#e11d48' },
            { text: 'USART', color: '#1d4ed8' },
            { text: 'SPI', color: '#9333ea' },
            { text: 'I2C', color: '#0ea5e9' },
            { text: 'CAN BUS', color: '#db2777' },
            { text: 'USB', color: '#65a30d' },
            { text: 'MISC', color: '#4b5563' },
            { text: 'BOARD HARDWARE', color: '#ea580c' }
        ];

        let currentY = 24;
        legendItems.forEach(item => {
            legendGroup.add(new Konva.Rect({
                x: 8, y: currentY, width: 176, height: 18,
                fill: item.color, stroke: 'rgba(0,0,0,0.5)', strokeWidth: 1
            }));
            legendGroup.add(new Konva.Text({
                x: 8, y: currentY + 4, width: 176, text: item.text,
                fontSize: 10, fontFamily: 'sans-serif', fill: 'white', align: 'center'
            }));
            currentY += 20;
        });

        // Legend Footer (Lines)
        currentY += 8;
        legendGroup.add(new Konva.Line({ points: [8, currentY, 184, currentY], stroke: '#d1d5db', strokeWidth: 1 }));
        currentY += 8;
        
        legendGroup.add(new Konva.Line({ points: [8, currentY+5, 28, currentY+5], stroke: 'black', strokeWidth: 1 }));
        legendGroup.add(new Konva.Text({ x: 36, y: currentY, text: 'Standard Pin', fontSize: 10, fill: '#4b5563' }));
        
        currentY += 16;
        // Approximate wave for PWM
        legendGroup.add(new Konva.Line({ 
            points: [8, currentY+5, 13, currentY, 18, currentY+5, 28, currentY+5], 
            stroke: 'black', strokeWidth: 1, tension: 0.4 
        }));
        legendGroup.add(new Konva.Text({ x: 36, y: currentY, text: 'PWM Pin', fontSize: 10, fill: '#4b5563' }));

        if (contentLayer) {
            contentLayer.add(legendGroup);
            contentLayer.draw();
        }

        // Wait a tiny bit for Konva to render the new group
        await new Promise(resolve => setTimeout(resolve, 100));

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
        alert("Failed to export PDF: " + (e instanceof Error ? e.message : String(e)));
    } finally {
        // Cleanup
        if (bgRect) {
            bgRect.destroy();
        }
        const tempLegend = stage.findOne('#temp-legend-export');
        if (tempLegend) {
            tempLegend.destroy();
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
          onDoubleClickPin={handlePinDoubleClick}
          isAddingPin={isAddingPin}
          onCreatePin={createPinAt}
          scale={scale}
          setScale={setScale}
          position={position}
          setPosition={setPosition}
          gapSize={gapSize}
        />
        <Sidebar 
          selectedPin={selectedPin} 
          onUpdatePin={updatePin} 
          onPushHistory={handlePushHistory}
          scale={scale}
          gapSize={gapSize}
          onGapSizeChange={setGapSize}
        />
      </div>
    </div>
  );
}

export default App;
