import { useState, useRef, useEffect, useEffectEvent } from 'react';
import Konva from 'konva';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { CanvasStage } from './components/CanvasStage';
import { ProductLibrary } from './components/ProductLibrary';
import type { Product } from './components/ProductLibrary';
import type { PinData, LineData, LegendItem, LegendMode } from './types';
import { DEFAULT_ANCHOR_SIZE, DEFAULT_GAP_SIZE, DEFAULT_LEGEND_ITEMS } from './constants';
import { DEFAULT_PIN_COLOR, scaleLabelsAroundAnchors } from './utils/pinUtils';
import type { FocusSidebarInputDetail } from './components/Sidebar';
import { exportPinoutTemplate, importPinoutTemplate, parsePinoutTemplate, pinoutFileName } from './utils/pinoutTemplate';
import { loadImageElement, loadProjectImages, parseProject, serializeProject } from './utils/project';
import type { LoadedImage } from './utils/project';
import { exportPdf } from './utils/exportPdf';
import { clearAutosave, loadAutosave } from './utils/autosave';
import type { AutosaveRecord } from './utils/autosave';
import { useAutosave } from './hooks/useAutosave';
import { RestoreBanner } from './components/RestoreBanner';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { centreOn, fitToContent, getContentBounds, zoomAroundCentre, ZOOM_FACTOR } from './utils/viewport';
import { ARROW_DELTAS, nudgeImage, nudgeLine, nudgePin } from './utils/nudge';
import { duplicateLine, duplicatePin } from './utils/duplicate';

type HistoryState = { pins: PinData[]; lines: LineData[]; images: LoadedImage[]; labelScale: number | null };

const PROJECT_FILE_TYPES = [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }];

const isEditableElement = (el: Element | null) =>
  el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

/** Lets React commit and Konva repaint before reading the canvas. */
const nextFrame = () => new Promise(resolve => setTimeout(resolve, 50));

function App() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [pins, setPins] = useState<PinData[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  // Which label of the selected pin the user picked on the canvas (-1 = primary label),
  // so the sidebar can highlight and focus that function's editor.
  const [selectedFunctionIndex, setSelectedFunctionIndex] = useState(-1);
  const [lines, setLines] = useState<LineData[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [gapSize, setGapSize] = useState<number>(DEFAULT_GAP_SIZE);
  const [anchorSize, setAnchorSize] = useState<number>(DEFAULT_ANCHOR_SIZE);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [legendItems, setLegendItems] = useState<LegendItem[]>(() => DEFAULT_LEGEND_ITEMS.map(i => ({ ...i })));
  const [isLegendVisible, setIsLegendVisible] = useState<boolean>(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [legendMode, setLegendMode] = useState<LegendMode>('all');
  const [legendShowCounts, setLegendShowCounts] = useState<boolean>(false);

  // Lifted state for CanvasStage
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // World size of one label unit. Labels zoom together with the board, so the layout never
  // shifts. It is fixed when the first pin or line is created, using the zoom at that moment,
  // so labels start out at a comfortable on-screen size; the sidebar can change it later.
  const [labelScale, setLabelScale] = useState<number | null>(null);
  const effectiveLabelScale = labelScale ?? 1 / scale;
  const fixLabelScale = () => {
    if (labelScale === null) setLabelScale(effectiveLabelScale);
    return effectiveLabelScale;
  };

  // --- Autosave ---
  // The snapshot found at startup stays untouched until the user restores or discards it.
  const [recoveredAutosave, setRecoveredAutosave] = useState<AutosaveRecord | null>(null);
  const [autosaveChecked, setAutosaveChecked] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAutosave().then(record => {
      if (cancelled) return;
      setRecoveredAutosave(record);
      setAutosaveChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useAutosave(
    { images, pins, lines, scale, position, gapSize, legendItems, isLegendVisible, legendMode, legendShowCounts, anchorSize, labelScale },
    // Not while loading: pins are set before the images finish loading, and that half-loaded
    // state must not replace a good snapshot.
    autosaveChecked && !recoveredAutosave && !isLoadingProject,
  );

  const stageRef = useRef<Konva.Stage>(null);
  const copiedPinRef = useRef<PinData | null>(null); // For Ctrl+C/V
  const copiedLineRef = useRef<LineData | null>(null); // For Ctrl+C/V

  // --- Undo / Redo ---
  // pushHistory() must be called BEFORE a change, so the snapshot is the state to return to.
  const pastRef = useRef<HistoryState[]>([]);
  const futureRef = useRef<HistoryState[]>([]);

  const snapshot = (): HistoryState => ({
    pins: pins.map(p => ({ ...p })),
    lines: lines.map(l => ({ ...l })),
    images: images.map(i => ({ ...i })),
    labelScale,
  });

  const restore = (state: HistoryState) => {
    setPins(state.pins);
    setLines(state.lines);
    setImages(state.images);
    setLabelScale(state.labelScale);
  };

  const pushHistory = () => {
    pastRef.current.push(snapshot());
    futureRef.current = [];
  };

  const resetHistory = () => {
    pastRef.current = [];
    futureRef.current = [];
  };

  const handleUndo = () => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(snapshot());
    restore(prev);
  };

  const handleRedo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(snapshot());
    restore(next);
  };

  const clearSelection = () => {
    setSelectedPinId(null);
    setSelectedFunctionIndex(-1);
    setSelectedLineId(null);
    setSelectedImageId(null);
  };

  // --- Images ---
  const addImage = (src: string, element: HTMLImageElement, x: number, y: number) => {
    pushHistory();
    const newImg: LoadedImage = {
      id: crypto.randomUUID(),
      src,
      element,
      x,
      y,
      width: element.width,
      height: element.height,
      rotation: 0,
    };
    setImages(prev => [...prev, newImg]);
    clearSelection();
    setSelectedImageId(newImg.id);
    return newImg;
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      try {
        addImage(result, await loadImageElement(result), 0, 0);
      } catch {
        alert(`Failed to load "${file.name}". Is it a valid image?`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImportProduct = async (product: Product, withPinout = false) => {
    if (!product.image_url) return;
    let element: HTMLImageElement;
    try {
      element = await loadImageElement(product.image_url);
    } catch {
      alert(`Failed to load image for "${product.name}". Please check the image URL.`);
      return;
    }
    // addImage records the one history step; the pinout below rides along with it, so a single
    // undo removes the image and its pins together.
    const image = addImage(product.image_url, element, 50, 50);
    setIsLibraryOpen(false);
    if (!withPinout) return;

    const template = parsePinoutTemplate(product.pinout);
    if (!template) {
      console.warn(`[PinoutMaker] Ignoring invalid pinout template for "${product.name}"; imported the image only.`);
      return;
    }
    const imported = importPinoutTemplate(template, image, labelScale);
    if (labelScale === null) setLabelScale(imported.labelScale);
    setPins(prev => [...prev, ...imported.pins]);
    setLines(prev => [...prev, ...imported.lines]);
    // The legend is not part of undo; only add rows the project doesn't have yet.
    setLegendItems(prev => {
      const known = new Set(prev.map(i => i.text.trim().toLowerCase()));
      const added = imported.legendItems.filter(i => !known.has(i.text.trim().toLowerCase()));
      return added.length ? [...prev, ...added] : prev;
    });
  };

  /** Downloads the pins and lines, relative to the selected image, as a library pinout template. */
  const handleExportPinoutTemplate = () => {
    const image = images.find(img => img.id === selectedImageId);
    if (!image) return;
    const template = exportPinoutTemplate(image, pins, lines, effectiveLabelScale, legendItems);
    const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = pinoutFileName(image.src);
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRotateImage = () => {
    const targetId = selectedImageId ?? images[0]?.id; // Rotate first image if nothing selected
    if (!targetId) return;
    pushHistory();
    setImages(prev => prev.map(img => (img.id === targetId ? { ...img, rotation: (img.rotation + 90) % 360 } : img)));
  };

  const updateImage = (updatedImage: LoadedImage, saveHistory = true) => {
    if (saveHistory) pushHistory();
    setImages(prev => prev.map(img => (img.id === updatedImage.id ? updatedImage : img)));
  };

  // --- Modes ---
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

  // --- Pins & lines ---
  const createPinAt = (x: number, y: number) => {
    // Click position is the anchor; the label sits 50 label units right, vertically centered.
    const ls = fixLabelScale();
    const newPin: PinData = {
      id: crypto.randomUUID(),
      x: x + 50 * ls,
      y: y - 13 * ls,
      targetX: x,
      targetY: y,
      text: 'New Pin',
      color: DEFAULT_PIN_COLOR,
      isPwm: false,
    };
    pushHistory();
    setPins(prev => [...prev, newPin]);
    clearSelection();
    setSelectedPinId(newPin.id);
    setIsAddingPin(false);
  };

  const createLineAt = (points: number[]) => {
    fixLabelScale();
    const newLine: LineData = {
      id: crypto.randomUUID(),
      points,
      color: '#1f2937',
      thickness: 2,
    };
    pushHistory();
    setLines(prev => [...prev, newLine]);
    clearSelection();
    setSelectedLineId(newLine.id);
    setIsAddingLine(false);
  };

  const updatePin = (updatedPin: PinData, saveHistory = true) => {
    if (saveHistory) pushHistory();
    setPins(prev => prev.map(pin => (pin.id === updatedPin.id ? updatedPin : pin)));
  };

  /** Resizes all labels; their offsets from the anchors scale too, so the layout keeps its shape. */
  const changeLabelScale = (next: number, saveHistory = true) => {
    if (!(next > 0)) return;
    if (saveHistory) pushHistory();
    const ratio = next / effectiveLabelScale;
    setPins(prev => scaleLabelsAroundAnchors(prev, ratio));
    setLabelScale(next);
  };

  const updateLine = (updatedLine: LineData, saveHistory = true) => {
    if (saveHistory) pushHistory();
    setLines(prev => prev.map(line => (line.id === updatedLine.id ? updatedLine : line)));
  };

  const deleteSelected = () => {
    if (selectedPinId) {
      pushHistory();
      setPins(prev => prev.filter(pin => pin.id !== selectedPinId));
      setSelectedPinId(null);
    } else if (selectedLineId) {
      pushHistory();
      setLines(prev => prev.filter(line => line.id !== selectedLineId));
      setSelectedLineId(null);
    } else if (selectedImageId) {
      pushHistory();
      setImages(prev => prev.filter(img => img.id !== selectedImageId));
      setSelectedImageId(null);
    }
  };

  const selectPin = (id: string | null, functionIndex = -1) => {
    setSelectedPinId(id);
    setSelectedFunctionIndex(functionIndex);
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

  const handlePinDoubleClick = (id: string, functionIndex: number) => {
    clearSelection();
    setSelectedPinId(id);
    setSelectedFunctionIndex(functionIndex);
    // Focus the editor of the double-clicked label (pin name or function) in the sidebar
    window.dispatchEvent(new CustomEvent<FocusSidebarInputDetail>('focus-sidebar-input', { detail: { functionIndex } }));
  };

  const copySelection = () => {
    const pin = pins.find(p => p.id === selectedPinId);
    const line = lines.find(l => l.id === selectedLineId);
    if (pin) {
      copiedPinRef.current = { ...pin };
      copiedLineRef.current = null;
    } else if (line) {
      copiedLineRef.current = { ...line };
      copiedPinRef.current = null;
    }
  };

  const pasteClipboard = () => {
    // Each paste is offset 20 units from the previous one, so repeated pastes chain.
    if (copiedPinRef.current) {
      const newPin = duplicatePin(copiedPinRef.current);
      pushHistory();
      setPins(prev => [...prev, newPin]);
      clearSelection();
      setSelectedPinId(newPin.id);
      copiedPinRef.current = newPin;
    } else if (copiedLineRef.current) {
      const newLine = duplicateLine(copiedLineRef.current);
      pushHistory();
      setLines(prev => [...prev, newLine]);
      clearSelection();
      setSelectedLineId(newLine.id);
      copiedLineRef.current = newLine;
    }
  };

  /** Duplicates the selection in place (paste offset) without touching the clipboard. */
  const duplicateSelection = () => {
    const pin = pins.find(p => p.id === selectedPinId);
    const line = lines.find(l => l.id === selectedLineId);
    if (pin) {
      const copy = duplicatePin(pin);
      pushHistory();
      setPins(prev => [...prev, copy]);
      clearSelection();
      setSelectedPinId(copy.id);
    } else if (line) {
      const copy = duplicateLine(line);
      pushHistory();
      setLines(prev => [...prev, copy]);
      clearSelection();
      setSelectedLineId(copy.id);
    }
  };

  // --- Viewport shortcuts ---
  const getViewportSize = () => {
    const stage = stageRef.current;
    return { width: stage?.width() ?? window.innerWidth - 320, height: stage?.height() ?? window.innerHeight - 56 };
  };
  const contentBounds = () => getContentBounds({ images, pins, lines, labelScale: effectiveLabelScale, gapSize });

  const fitToScreen = () => {
    const view = fitToContent(contentBounds(), getViewportSize());
    setScale(view.scale);
    setPosition(view.position);
  };

  const resetZoom = () => {
    setScale(1);
    setPosition(centreOn(contentBounds(), getViewportSize(), 1));
  };

  const zoomBy = (factor: number) => {
    const view = zoomAroundCentre({ scale, position }, getViewportSize(), factor);
    setScale(view.scale);
    setPosition(view.position);
  };

  /** Arrow-key nudge of the selection. One history entry per key-hold burst (not on auto-repeat). */
  const nudgeSelection = (e: KeyboardEvent) => {
    const [ux, uy] = ARROW_DELTAS[e.key];
    const step = e.shiftKey ? 10 : 1;
    const dx = ux * step;
    const dy = uy * step;
    const pin = pins.find(p => p.id === selectedPinId);
    const line = lines.find(l => l.id === selectedLineId);
    const image = images.find(i => i.id === selectedImageId);
    if (!pin && !line && !image) return; // nothing selected: let the page scroll as usual
    e.preventDefault();
    if (!e.repeat) pushHistory();
    if (pin) updatePin(nudgePin(pin, dx, dy, e.altKey), false);
    else if (line) updateLine(nudgeLine(line, dx, dy), false);
    else if (image) updateImage(nudgeImage(image, dx, dy), false);
  };

  // --- Save / load ---
  const getProjectJson = () =>
    JSON.stringify(
      serializeProject({ images, pins, lines, scale, position, gapSize, legendItems, isLegendVisible, legendMode, legendShowCounts, anchorSize, labelScale }),
      null,
      2,
    );

  const writeToHandle = async (handle: FileSystemFileHandle, json: string) => {
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
  };

  const handleSaveProject = async () => {
    const json = getProjectJson();
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({ suggestedName: 'pinout-project.json', types: PROJECT_FILE_TYPES });
        await writeToHandle(handle, json);
        setFileHandle(handle);
      } else {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pinout-project.json';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return; // user cancelled the picker
      console.error('Save failed:', error);
      alert('Failed to save the project.');
    }
  };

  const handleQuickSave = async () => {
    if (!fileHandle) return handleSaveProject();
    try {
      await writeToHandle(fileHandle, getProjectJson());
    } catch (error) {
      console.error('Failed to quick save:', error);
      alert('Failed to save file. You may need to Save As anew.');
    }
  };

  const pickProjectFile = async (): Promise<{ content: string; handle: FileSystemFileHandle | null } | null> => {
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({ types: PROJECT_FILE_TYPES });
      return { content: await (await handle.getFile()).text(), handle };
    }
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        resolve(file ? { content: await file.text(), handle: null } : null);
      };
      input.click();
    });
  };

  /** Single entry point for opening a project (file or autosave). Returns false for invalid content. */
  const openProject = async (content: string, handle: FileSystemFileHandle | null): Promise<boolean> => {
    let data;
    try {
      data = parseProject(content);
    } catch (e) {
      console.error('Failed to parse project file', e);
      alert('Invalid project file');
      return false;
    }

    // A new project starts with a clean slate: no undo into the previous one, no stale selection.
    resetHistory();
    clearSelection();
    setIsAddingPin(false);
    setIsAddingLine(false);
    copiedPinRef.current = null;
    copiedLineRef.current = null;
    setFileHandle(handle);

    setIsLoadingProject(true);
    setImages([]);
    setPins(data.pins);
    setLines(data.lines);
    setScale(data.scale);
    setPosition(data.position);
    setGapSize(data.gapSize);
    setLegendItems(data.legendItems);
    setIsLegendVisible(data.isLegendVisible);
    setLegendMode(data.legendMode);
    setLegendShowCounts(data.legendShowCounts);
    setAnchorSize(data.anchorSize);
    setLabelScale(data.labelScale);

    const { loaded, failed } = await loadProjectImages(data.images);
    setImages(loaded);
    setIsLoadingProject(false);
    if (failed > 0) {
      alert(`${failed} image(s) in this project could not be loaded.`);
    }
    return true;
  };

  const handleLoadProject = async () => {
    let picked;
    try {
      picked = await pickProjectFile();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to open project file', error);
      return;
    }
    if (!picked) return;
    await openProject(picked.content, picked.handle);
  };

  const handleRestoreAutosave = async () => {
    const record = recoveredAutosave;
    if (!record) return;
    setRecoveredAutosave(null); // hides the banner and lets autosave resume (paused while loading)
    // A snapshot that no longer parses is useless: drop it rather than offering it again.
    if (!(await openProject(JSON.stringify(record.project), null))) clearAutosave();
  };

  const handleDiscardAutosave = () => {
    setRecoveredAutosave(null);
    void clearAutosave();
  };

  const handleExportPdf = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    // Hide selection outlines and handles from the export
    clearSelection();
    await nextFrame();
    try {
      const exported = await exportPdf(stage, { images, pins, lines, scale, labelScale: effectiveLabelScale, gapSize, legendItems, isLegendVisible, legendMode });
      if (!exported) alert('Nothing to export!');
    } catch (e) {
      console.error('PDF Export failed', e);
      alert('Failed to export PDF: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  // --- Keyboard shortcuts ---
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    // Typing in a field keeps the browser's own behaviour (text undo, backspace, copy/paste)
    if (isEditableElement(document.activeElement)) return;

    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (isHelpOpen) {
      if (e.key === 'Escape' || e.key === '?') setIsHelpOpen(false);
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelected();
    } else if (e.key in ARROW_DELTAS && !mod) {
      nudgeSelection(e);
    } else if (e.key === 'Escape') {
      clearSelection();
      setIsAddingPin(false);
      setIsAddingLine(false);
    } else if (e.key === '?') {
      setIsHelpOpen(true);
    } else if (e.shiftKey && !mod && e.code === 'Digit1') {
      fitToScreen();
    } else if (mod && e.code === 'Digit0') {
      e.preventDefault();
      resetZoom();
    } else if (mod && (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd')) {
      e.preventDefault();
      zoomBy(ZOOM_FACTOR);
    } else if (mod && (e.key === '-' || e.code === 'NumpadSubtract')) {
      e.preventDefault();
      zoomBy(1 / ZOOM_FACTOR);
    } else if (mod && key === 'd') {
      e.preventDefault();
      duplicateSelection();
    } else if (mod && key === 'c') {
      copySelection();
    } else if (mod && key === 'v') {
      pasteClipboard();
    } else if (mod && (key === 'y' || (e.shiftKey && key === 'z'))) {
      e.preventDefault();
      handleRedo();
    } else if (mod && key === 'z') {
      e.preventDefault();
      handleUndo();
    } else if (mod && key === 's') {
      e.preventDefault();
      handleQuickSave();
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectedPin = pins.find(p => p.id === selectedPinId) || null;
  const selectedLine = lines.find(l => l.id === selectedLineId) || null;
  const selectedImage = images.find(img => img.id === selectedImageId) || null;

  return (
    <div className='h-screen w-screen flex flex-col overflow-hidden bg-white'>
      <TopBar
        onImport={handleImageUpload}
        onAddPin={toggleAddPinMode}
        onAddLine={toggleAddLineMode}
        onDeletePin={deleteSelected}
        onRotateImage={handleRotateImage}
        onSave={handleSaveProject}
        onLoad={handleLoadProject}
        onExportPdf={handleExportPdf}
        isPinSelected={!!selectedPinId || !!selectedLineId || !!selectedImageId}
        isImageLoaded={images.length > 0}
        isAddingPin={isAddingPin}
        isAddingLine={isAddingLine}
        onToggleLibrary={() => setIsLibraryOpen(o => !o)}
        isLibraryOpen={isLibraryOpen}
      />
      <ProductLibrary
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onImportProduct={handleImportProduct}
      />
      {isHelpOpen && <ShortcutsHelp onClose={() => setIsHelpOpen(false)} />}
      <div className='flex flex-1 overflow-hidden'>
        <div className='relative flex flex-1 min-w-0'>
          {recoveredAutosave && (
            <RestoreBanner
              savedAt={recoveredAutosave.savedAt}
              onRestore={handleRestoreAutosave}
              onDiscard={handleDiscardAutosave}
            />
          )}
          <CanvasStage
            ref={stageRef}
            images={images}
            onUpdateImage={updateImage}
            selectedImageId={selectedImageId}
            onSelectImage={setSelectedImageId}
            pins={pins}
            selectedPinId={selectedPinId}
            selectedFunctionIndex={selectedFunctionIndex}
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
            legendMode={legendMode}
            legendShowCounts={legendShowCounts}
            anchorSize={anchorSize}
            labelScale={effectiveLabelScale}
            onPushHistory={pushHistory}
            onFitToScreen={fitToScreen}
          />
        </div>
        <Sidebar
          selectedPin={selectedPin}
          selectedFunctionIndex={selectedFunctionIndex}
          onSelectFunctionIndex={setSelectedFunctionIndex}
          onUpdatePin={updatePin}
          selectedLine={selectedLine}
          onUpdateLine={updateLine}
          selectedImage={selectedImage}
          onUpdateImage={updateImage}
          onPushHistory={pushHistory}
          onExportPinoutTemplate={handleExportPinoutTemplate}
          gapSize={gapSize}
          onGapSizeChange={setGapSize}
          legendItems={legendItems}
          onLegendItemsChange={setLegendItems}
          isLegendVisible={isLegendVisible}
          onLegendVisibilityChange={setIsLegendVisible}
          legendMode={legendMode}
          onLegendModeChange={setLegendMode}
          legendShowCounts={legendShowCounts}
          onLegendShowCountsChange={setLegendShowCounts}
          anchorSize={anchorSize}
          onAnchorSizeChange={setAnchorSize}
          labelScale={effectiveLabelScale}
          onLabelScaleChange={changeLabelScale}
        />
      </div>
    </div>
  );
}

export default App;
