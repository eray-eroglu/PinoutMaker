import { useState, useRef, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { CanvasStage } from './components/CanvasStage';
import type { PinData, LineData, ProjectData, LegendItem, BoardImage } from './types';

export interface LoadedImage extends BoardImage {
  element: HTMLImageElement;
}
import jsPDF from 'jspdf';
import Konva from 'konva';

function App() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [pins, setPins] = useState<PinData[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [lines, setLines] = useState<LineData[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [gapSize, setGapSize] = useState<number>(12);
  const [anchorSize, setAnchorSize] = useState<number>(5);
  
  const DEFAULT_LEGEND_ITEMS: LegendItem[] = [
    { id: '1', text: 'POWER', color: '#dc2626' },
    { id: '2', text: 'GROUND', color: '#000000' },
    { id: '3', text: 'PHYSICAL PIN', color: '#0d9488' },
    { id: '4', text: 'CONTROL', color: '#ca8a04' },
    { id: '5', text: 'ANALOG', color: '#16a34a' },
    { id: '6', text: 'TIMER & CHANNEL', color: '#e11d48' },
    { id: '7', text: 'USART', color: '#1d4ed8' },
    { id: '8', text: 'SPI', color: '#9333ea' },
    { id: '9', text: 'I2C', color: '#0ea5e9' },
    { id: '10', text: 'CAN BUS', color: '#db2777' },
    { id: '11', text: 'USB', color: '#65a30d' },
    { id: '12', text: 'MISC', color: '#4b5563' },
    { id: '13', text: 'BOARD HARDWARE', color: '#ea580c' },
  ];
  const [legendItems, setLegendItems] = useState<LegendItem[]>(DEFAULT_LEGEND_ITEMS);
  const [isLegendVisible, setIsLegendVisible] = useState<boolean>(true);

  // Lifted state for CanvasStage
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const stageRef = useRef<Konva.Stage>(null);
  const copiedPinRef = useRef<PinData | null>(null); // For Ctrl+C/V
  const copiedLineRef = useRef<LineData | null>(null); // For Ctrl+C/V

  // Undo / Redo History
  type HistoryState = { pins: PinData[]; lines: LineData[]; images: LoadedImage[] };
  const pastRef = useRef<HistoryState[]>([]);
  const futureRef = useRef<HistoryState[]>([]);

  const pushHistory = () => {
    pastRef.current.push({
      pins: pins.map(p => ({...p})),
      lines: lines.map(l => ({...l})),
      images: images.map(i => ({...i}))
    });
    futureRef.current = [];
  };

  const handlePushHistory = () => pushHistory();

  const handleUndo = () => {
    if (pastRef.current.length === 0) return;
    const prev = pastRef.current.pop()!;
    futureRef.current.push({
      pins: pins.map(p => ({...p})),
      lines: lines.map(l => ({...l})),
      images: images.map(i => ({...i}))
    });
    setPins(prev.pins);
    setLines(prev.lines);
    setImages(prev.images);
  };

  const handleRedo = () => {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current.pop()!;
    pastRef.current.push({
      pins: pins.map(p => ({...p})),
      lines: lines.map(l => ({...l})),
      images: images.map(i => ({...i}))
    });
    setPins(next.pins);
    setLines(next.lines);
    setImages(next.images);
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const img = new Image();
      img.src = result;
      img.onload = () => {
        pushHistory();
        const newImg: LoadedImage = {
          id: crypto.randomUUID(),
          src: result,
          element: img,
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
          rotation: 0
        };
        setImages(prev => [...prev, newImg]);
        setSelectedImageId(newImg.id);
      };
    };
    reader.readAsDataURL(file);
  };

  const handleRotateImage = () => {
    pushHistory();
    setImages(prev => prev.map((img, idx) => {
      if (selectedImageId && img.id !== selectedImageId) return img;
      if (!selectedImageId && idx !== 0) return img; // Rotate first image if nothing selected
      return { ...img, rotation: (img.rotation + 90) % 360 };
    }));
  };

  const updateImage = (updatedImage: LoadedImage, saveHistory = true) => {
    if (saveHistory) pushHistory();
    setImages(prev => prev.map(img => img.id === updatedImage.id ? updatedImage : img));
  };

  const toggleAddPinMode = () => {
    setIsAddingPin(!isAddingPin);
    setIsAddingLine(false);
    setSelectedPinId(null);
    setSelectedLineId(null);
  };

  const toggleAddLineMode = () => {
    setIsAddingLine(!isAddingLine);
    setIsAddingPin(false);
    setSelectedPinId(null);
    setSelectedLineId(null);
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
    pushHistory();
    setPins((prev) => [...prev, newPin]);
    setSelectedPinId(newPin.id);
    setIsAddingPin(false);
  };

  const createLineAt = (x: number, y: number) => {
    const newLine: LineData = {
      id: crypto.randomUUID(),
      x1: x,
      y1: y,
      x2: x + (100 / scale),
      y2: y + (100 / scale),
      color: '#3b82f6',
      thickness: 2
    };
    pushHistory();
    setLines((prev) => [...prev, newLine]);
    setSelectedLineId(newLine.id);
    setIsAddingLine(false);
  };

  const updatePin = (updatedPin: PinData, saveHistory = true) => {
    if (saveHistory) pushHistory();
    setPins((prevPins) => prevPins.map((pin) => (pin.id === updatedPin.id ? updatedPin : pin)));
  };

  const updateLine = (updatedLine: LineData, saveHistory = true) => {
    if (saveHistory) pushHistory();
    setLines((prevLines) => prevLines.map((line) => (line.id === updatedLine.id ? updatedLine : line)));
  };

  const deletePin = () => {
    if (selectedPinId) {
      pushHistory();
      setPins((prevPins) => prevPins.filter((pin) => pin.id !== selectedPinId));
      setSelectedPinId(null);
    } else if (selectedLineId) {
      pushHistory();
      setLines((prevLines) => prevLines.filter((line) => line.id !== selectedLineId));
      setSelectedLineId(null);
    } else if (selectedImageId) {
      pushHistory();
      setImages((prev) => prev.filter((img) => img.id !== selectedImageId));
      setSelectedImageId(null);
    }
  };

  const selectPin = (id: string | null) => {
    setSelectedPinId(id);
    if (id) {
      setSelectedLineId(null);
      setSelectedImageId(null);
    }
  };

  const selectLine = (id: string | null) => {
    setSelectedLineId(id);
    if (id) {
      setSelectedPinId(null);
      setSelectedImageId(null);
    }
  };
  
  const handlePinDoubleClick = (id: string) => {
    // When double clicking a pin, we just want to ensure it is selected
    // so that the sidebar input becomes active.
    // We can also focus the sidebar input programmatically if needed.
    console.log("App: handlePinDoubleClick", id);
    setSelectedPinId(id);
    setSelectedLineId(null);
    setSelectedImageId(null);
    
    // Dispatch a custom event to focus the sidebar input
    window.dispatchEvent(new CustomEvent('focus-sidebar-input'));
  };

  const selectedPin = pins.find((p) => p.id === selectedPinId) || null;
  const selectedLine = lines.find((l) => l.id === selectedLineId) || null;
  const selectedImage = images.find(img => img.id === selectedImageId) || null;

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
          
          pushHistory();
          setPins((prevPins) => prevPins.filter((p) => p.id !== selectedPinId));
          setSelectedPinId(null);
        } else if (selectedLineId) {
          const activeElement = document.activeElement as HTMLElement | null;
          if (
            activeElement &&
            (activeElement.tagName === 'INPUT' ||
              activeElement.tagName === 'TEXTAREA' ||
              activeElement.isContentEditable)
          ) {
            return;
          }
          
          pushHistory();
          setLines((prevLines) => prevLines.filter((l) => l.id !== selectedLineId));
          setSelectedLineId(null);
        } else if (selectedImageId) {
          pushHistory();
          setImages((prev) => prev.filter((img) => img.id !== selectedImageId));
          setSelectedImageId(null);
        }
      }

      // Copy (Ctrl+C or Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const pinToCopy = pins.find(p => p.id === selectedPinId);
        if (pinToCopy) {
          copiedPinRef.current = { ...pinToCopy }; // Deep copy not needed if object is flat, but spread is good
          copiedLineRef.current = null;
        }
        
        const lineToCopy = lines.find(l => l.id === selectedLineId);
        if (lineToCopy) {
          copiedLineRef.current = { ...lineToCopy };
          copiedPinRef.current = null;
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

          pushHistory();
          setPins((prevPins) => [...prevPins, newPin]);
          setSelectedPinId(newId);
          setSelectedLineId(null);
          
          // Update clipboard to the new pin so the next paste chains from this one
          copiedPinRef.current = newPin;
        } else if (copiedLineRef.current) {
          const original = copiedLineRef.current;
          const newId = crypto.randomUUID();
          const newLine: LineData = {
            ...original,
            id: newId,
            x1: original.x1 + 20,
            y1: original.y1 + 20,
            x2: original.x2 + 20,
            y2: original.y2 + 20,
          };

          pushHistory();
          setLines((prevLines) => [...prevLines, newLine]);
          setSelectedLineId(newId);
          setSelectedPinId(null);
          copiedLineRef.current = newLine;
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
  }, [selectedPinId, selectedLineId, selectedImageId, pins, lines, images, scale, position, fileHandle]);

  const handleQuickSave = async () => {
    const boardImages = images.map(img => ({
      id: img.id,
      src: img.src,
      x: img.x,
      y: img.y,
      width: img.width,
      height: img.height,
      rotation: img.rotation
    }));

    const projectData: ProjectData = {
      images: boardImages,
      pins,
      lines,
      scale,
      position,
      gapSize,
      legendItems,
      isLegendVisible,
      anchorSize
    };

    const json = JSON.stringify(projectData, null, 2);

    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(json);
        await writable.close();
        console.log('Quick save successful');
      } catch (error) {
        console.error('Failed to quick save:', error);
        alert('Failed to save file. You may need to Save As anew.');
      }
    } else {
      await handleSaveProject();
    }
  };

  const handleSaveProject = async () => {
    const boardImages = images.map(img => ({
      id: img.id,
      src: img.src,
      x: img.x,
      y: img.y,
      width: img.width,
      height: img.height,
      rotation: img.rotation
    }));

    const projectData: ProjectData = {
      images: boardImages,
      pins,
      lines,
      scale,
      position,
      gapSize,
      legendItems,
      isLegendVisible,
      anchorSize
    };

    const json = JSON.stringify(projectData, null, 2);
    
    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: 'pinout-project.json',
          types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        setFileHandle(handle);
      } else {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pinout-project.json';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleLoadProject = async () => {
    try {
      let content = null;
      if ('showOpenFilePicker' in window) {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
        });
        const file = await handle.getFile();
        content = await file.text();
        setFileHandle(handle);
      } else {
        content = await new Promise<string | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              resolve(await file.text());
            } else {
              resolve(null);
            }
          };
          input.click();
        });
      }

      if (!content) return;
      const data: ProjectData = JSON.parse(content);
      
      if (data.image) {
        // Legacy single image support
        const img = new Image();
        img.src = data.image;
        img.onload = () => {
          setImages([{
            id: crypto.randomUUID(),
            src: data.image as string,
            element: img,
            x: 0,
            y: 0,
            width: img.width,
            height: img.height,
            rotation: data.rotation || 0
          }]);
        };
      } else if (data.images && data.images.length > 0) {
        Promise.all(data.images.map(bImg => new Promise<LoadedImage>((resolve) => {
          const img = new Image();
          img.src = bImg.src;
          img.onload = () => resolve({ ...bImg, element: img });
        }))).then(loadedImgs => {
          setImages(loadedImgs);
        });
      } else {
        setImages([]);
      }

      setPins(data.pins || []);
      setLines(data.lines || []);
      setScale(data.scale || 1);
      setPosition(data.position || { x: 0, y: 0 });
      setGapSize(data.gapSize ?? 12);
      setLegendItems(data.legendItems && data.legendItems.length > 0 ? data.legendItems : DEFAULT_LEGEND_ITEMS);
      setIsLegendVisible(data.isLegendVisible ?? true);
      setAnchorSize(data.anchorSize ?? 5);
      
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
    if (images.length > 0) {
        hasContent = true;
        images.forEach(img => {
            // Images are drawn with offsetX = width/2, offsetY = height/2 relative to x,y
            // So we calculate the real bounding box of each rotated image
            const w = img.width;
            const h = img.height;
            const radius = Math.sqrt(w*w + h*h) / 2;
            
            // To be strictly correct but simple, we can use the radius to form a safe bounding box.
            const centerX = img.x;
            const centerY = img.y;
            
            if (centerX - radius < minX) minX = centerX - radius;
            if (centerX + radius > maxX) maxX = centerX + radius;
            if (centerY - radius < minY) minY = centerY - radius;
            if (centerY + radius > maxY) maxY = centerY + radius;
        });
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

        if (isLegendVisible) {
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
                x: 0, y: 0, width: 192, height: 40 + (legendItems.length * 20) + 40,
                fill: '#e6e6e6', stroke: '#d1d5db', strokeWidth: 1,
                cornerRadius: 4, shadowColor: 'black', shadowBlur: 4, shadowOpacity: 0.1
            }));

            // Legend Title
            legendGroup.add(new Konva.Text({
                x: 8, y: 8, text: 'TABLE', fontSize: 12, fontFamily: 'sans-serif', fill: '#4b5563'
            }));

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

        pdf.save('pinout-diagram.pdf');

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
        onAddLine={toggleAddLineMode}
        onDeletePin={deletePin}
        onRotateImage={handleRotateImage}
        onSave={handleSaveProject}
        onLoad={handleLoadProject}
        onExportPdf={handleExportPdf}
        isPinSelected={!!selectedPinId || !!selectedLineId || !!selectedImageId}
        isImageLoaded={images.length > 0}
        isAddingPin={isAddingPin}
        isAddingLine={isAddingLine}
      />
      <div className='flex flex-1 overflow-hidden'>
        <CanvasStage
          ref={stageRef}
          images={images}
          onUpdateImage={updateImage}
          selectedImageId={selectedImageId}
          onSelectImage={setSelectedImageId}
          pins={pins}
          selectedPinId={selectedPinId}
          onSelectPin={selectPin}
          onUpdatePin={updatePin}
          onDoubleClickPin={handlePinDoubleClick}
          lines={lines}
          selectedLineId={selectedLineId}
          onSelectLine={selectLine}
          onUpdateLine={updateLine}
          isAddingLine={isAddingLine}
          onCreateLine={createLineAt}
          isAddingPin={isAddingPin}
          onCreatePin={createPinAt}
          scale={scale}
          setScale={setScale}
          position={position}
          setPosition={setPosition}
          gapSize={gapSize}
          legendItems={legendItems}
          isLegendVisible={isLegendVisible}
          anchorSize={anchorSize}
        />
        <Sidebar 
          selectedPin={selectedPin} 
          onUpdatePin={updatePin} 
          selectedLine={selectedLine}
          onUpdateLine={updateLine}
          selectedImage={selectedImage}
          onUpdateImage={updateImage}
          onPushHistory={handlePushHistory}
          scale={scale}
          gapSize={gapSize}
          onGapSizeChange={setGapSize}
          legendItems={legendItems}
          onLegendItemsChange={setLegendItems}
          isLegendVisible={isLegendVisible}
          onLegendVisibilityChange={setIsLegendVisible}
          anchorSize={anchorSize}
          onAnchorSizeChange={setAnchorSize}
        />
      </div>
    </div>
  );
}

export default App;
