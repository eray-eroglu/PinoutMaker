import { useState, useRef, useEffect, useEffectEvent, useMemo } from 'react';
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
import { exportDiagram } from './utils/export';
import { prepareImportedImage } from './utils/imageImport';
import { buildPinListCsv, pinListFileName, PIN_LIST_MIME_TYPE } from './utils/pinList';
import type { ExportOptions } from './utils/export';
import { clearRecoveredAutosave, takeAutosaveForRecovery } from './utils/autosave';
import type { AutosaveRecord } from './utils/autosave';
import { useAutosave } from './hooks/useAutosave';
import { RestoreBanner } from './components/RestoreBanner';
import { EmptyState } from './components/EmptyState';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { centreOn, fitToContent, getContentBounds, zoomAroundCentre, ZOOM_FACTOR } from './utils/viewport';
import { ARROW_DELTAS, nudgeImage, nudgeLine } from './utils/nudge';
import { duplicateLine, duplicatePins } from './utils/duplicate';
import { HeaderPanel } from './components/HeaderPanel';
import { PinTableDialog } from './components/PinTableDialog';
import { DEFAULT_HEADER_SETTINGS, buildHeaderPins, getHeaders, imageCentreAt, resolveHeaderSide } from './utils/header';
import type { HeaderSettings, Point } from './utils/header';
import { applyPinTable } from './utils/pinTable';
import { addToSelection, existingIds, movePins, pickPins, primaryOf, removePins, toggleInSelection } from './utils/selection';
import { alignLabelEdgesToAnchor, alignLabelTops, applyRowPitch, averageRowPitch, distributeVertically, updatePins } from './utils/align';
import { combineIntoRows, planCombineRows } from './utils/combineRows';
import { LABEL_HEIGHT, layoutPinLabels } from './utils/pinLayout';
import { measureLabelText } from './utils/labelMeasure';
import { MultiPinPanel } from './components/MultiPinPanel';
import { isEditableElement, topOverlay } from './utils/keyboard';
import { deepEqual } from './utils/history';
import type { Overlay } from './utils/keyboard';
import { defineMessages, useLanguage, useMessages } from './i18n';

// The legend (rows and how the table is shown) is part of the drawing and its exports, so it is
// undoable too. Gap size and anchor size stay outside undo.
type HistoryState = {
  pins: PinData[];
  lines: LineData[];
  images: LoadedImage[];
  labelScale: number | null;
  legendItems: LegendItem[];
  isLegendVisible: boolean;
  legendMode: LegendMode;
  legendShowCounts: boolean;
};

const MESSAGES = defineMessages({
  en: {
    imageLoadFailed: (name: string) => `Failed to load "${name}". Is it a valid image?`,
    productImageLoadFailed: (name: string) => `Failed to load image for "${name}". Please check the image URL.`,
    saveFailed: 'Failed to save the project.',
    quickSaveFailed: 'Failed to save file. You may need to Save As anew.',
    invalidProject: 'Invalid project file',
    projectImagesFailed: (n: number) =>
      `${n} image(s) in this project could not be loaded. They are shown as grey placeholders and stay in the project when you save.`,
    confirmRestore: 'Replace the current canvas with the recovered work?',
    nothingToExport: 'Nothing to export!',
    exportFailed: (reason: string) => 'Failed to export: ' + reason,
  },
  tr: {
    imageLoadFailed: (name: string) => `"${name}" yüklenemedi. Geçerli bir görsel mi?`,
    productImageLoadFailed: (name: string) => `"${name}" için görsel yüklenemedi. Lütfen görsel adresini kontrol edin.`,
    saveFailed: 'Proje kaydedilemedi.',
    quickSaveFailed: 'Dosya kaydedilemedi. Farklı kaydetmeyi yeniden denemeniz gerekebilir.',
    invalidProject: 'Geçersiz proje dosyası',
    projectImagesFailed: (n: number) =>
      `Bu projedeki ${n} görsel yüklenemedi. Gri yer tutucu olarak gösteriliyorlar ve kaydettiğinizde projede kalıyorlar.`,
    confirmRestore: 'Mevcut tuval kurtarılan çalışmayla değiştirilsin mi?',
    nothingToExport: 'Dışa aktarılacak bir şey yok!',
    exportFailed: (reason: string) => 'Dışa aktarılamadı: ' + reason,
  },
});

const PROJECT_FILE_TYPES = [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }];

function App() {
  const t = useMessages(MESSAGES);
  const { language } = useLanguage();
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [pins, setPins] = useState<PinData[]>([]);
  // Selected pins in click order; the last one is the primary pin (single-pin editor).
  // Use selectedPinIds below, which drops pins that undo or delete removed.
  const [rawSelectedPinIds, setSelectedPinIds] = useState<string[]>([]);
  // Which label of the primary pin the user picked on the canvas (-1 = primary label),
  // so the sidebar can highlight and focus that function's editor.
  const [selectedFunctionIndex, setSelectedFunctionIndex] = useState(-1);
  const [lines, setLines] = useState<LineData[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [isAddingLine, setIsAddingLine] = useState(false);
  // Header tool: picking pads on the canvas, then a draft waiting for its settings
  const [isAddingHeader, setIsAddingHeader] = useState(false);
  const [headerDraft, setHeaderDraft] = useState<{ start: Point; end: Point } | null>(null);
  const [headerSettings, setHeaderSettings] = useState<HeaderSettings>(DEFAULT_HEADER_SETTINGS);
  const [isPinTableOpen, setIsPinTableOpen] = useState(false);
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [gapSize, setGapSize] = useState<number>(DEFAULT_GAP_SIZE);
  const [anchorSize, setAnchorSize] = useState<number>(DEFAULT_ANCHOR_SIZE);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [legendItems, setLegendItems] = useState<LegendItem[]>(() => DEFAULT_LEGEND_ITEMS.map(i => ({ ...i })));
  const [isLegendVisible, setIsLegendVisible] = useState<boolean>(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [legendMode, setLegendMode] = useState<LegendMode>('all');
  const [legendShowCounts, setLegendShowCounts] = useState<boolean>(false);
  // Multi-select option: dragging or nudging the selected pins moves their anchors too (as Alt does)
  const [moveAnchorsWithSelection, setMoveAnchorsWithSelection] = useState(false);

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
  // The snapshot found at startup is moved to its own slot, where it stays untouched until the
  // user restores or discards it; meanwhile autosave keeps protecting the new session.
  const [recoveredAutosave, setRecoveredAutosave] = useState<AutosaveRecord | null>(null);
  const [autosaveChecked, setAutosaveChecked] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  useEffect(() => {
    let cancelled = false;
    takeAutosaveForRecovery().then(record => {
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
    // Not before the startup snapshot was moved aside, and not while loading: pins are set
    // before the images finish loading, and that half-loaded state must not replace a good snapshot.
    autosaveChecked && !isLoadingProject,
  );

  const selectedPinIds = useMemo(() => existingIds(rawSelectedPinIds, pins), [rawSelectedPinIds, pins]);
  const selectedPinId = primaryOf(selectedPinIds);

  const stageRef = useRef<Konva.Stage>(null);
  const copiedPinsRef = useRef<PinData[] | null>(null); // For Ctrl+C/V
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
    legendItems: legendItems.map(i => ({ ...i })),
    isLegendVisible,
    legendMode,
    legendShowCounts,
  });

  const restore = (state: HistoryState) => {
    setPins(state.pins);
    setLines(state.lines);
    setImages(state.images);
    setLabelScale(state.labelScale);
    setLegendItems(state.legendItems);
    setIsLegendVisible(state.isLegendVisible);
    setLegendMode(state.legendMode);
    setLegendShowCounts(state.legendShowCounts);
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
    setSelectedPinIds([]);
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

  const handleImageUpload = async (file: File) => {
    try {
      // Very large photos are scaled down first: they are embedded in the project and its autosave
      const { src, element } = await prepareImportedImage(file);
      addImage(src, element, 0, 0);
    } catch {
      alert(t.imageLoadFailed(file.name));
    }
  };

  const handleImportProduct = async (product: Product, withPinout = false) => {
    if (!product.image_url) return;
    let element: HTMLImageElement;
    try {
      element = await loadImageElement(product.image_url);
    } catch {
      alert(t.productImageLoadFailed(product.name));
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
    // Only add legend rows the project doesn't have yet; they ride along with the image's undo step too.
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
  const stopHeaderTool = () => {
    setIsAddingHeader(false);
    setHeaderDraft(null);
  };

  const toggleAddPinMode = () => {
    setIsAddingPin(!isAddingPin);
    setIsAddingLine(false);
    stopHeaderTool();
    setSelectedPinIds([]);
    setSelectedLineId(null);
  };

  const toggleAddLineMode = () => {
    setIsAddingLine(!isAddingLine);
    setIsAddingPin(false);
    stopHeaderTool();
    setSelectedPinIds([]);
    setSelectedLineId(null);
  };

  const toggleAddHeaderMode = () => {
    setIsAddingHeader(!isAddingHeader && !headerDraft);
    setHeaderDraft(null);
    setIsAddingPin(false);
    setIsAddingLine(false);
    setSelectedPinIds([]);
    setSelectedLineId(null);
  };

  // --- Headers ---
  /** Auto label side faces away from the image under the header, else from the content's centre. */
  const headerSideFor = (start: Point, end: Point) => {
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const bounds = contentBounds();
    const centre = imageCentreAt(images, mid)
      ?? (bounds ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 } : null);
    return resolveHeaderSide('auto', start, end, centre);
  };

  const pickHeader = (start: Point, end: Point) => {
    setIsAddingHeader(false);
    setHeaderDraft({ start, end });
  };

  const buildDraftPins = (labelScaleForPins: number, newId?: () => string) =>
    headerDraft
      ? buildHeaderPins({
        ...headerDraft,
        settings: headerSettings,
        side: headerSettings.side === 'auto' ? autoHeaderSide : headerSettings.side,
        labelScale: labelScaleForPins,
        newId,
      })
      : [];

  const createHeader = () => {
    if (!headerDraft) return;
    const newPins = buildDraftPins(fixLabelScale());
    pushHistory();
    setPins(prev => [...prev, ...newPins]);
    clearSelection();
    setSelectedPinIds([newPins[0].id]);
    setHeaderDraft(null);
  };

  const headers = getHeaders(pins);

  const applyTable = (headerId: string, rows: string[][], reverse: boolean) => {
    const header = headers.find(h => h.id === headerId);
    if (!header) return;
    pushHistory();
    setPins(prev => applyPinTable(prev, header.pins, rows, reverse, { labelScale: effectiveLabelScale }));
    setIsPinTableOpen(false);
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
    setSelectedPinIds([newPin.id]);
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

  // --- Legend --- (each call is one undo step unless saveHistory is false; a no-op records nothing)
  const changeLegendItems = (next: LegendItem[], saveHistory = true) => {
    if (deepEqual(next, legendItems)) return;
    if (saveHistory) pushHistory();
    setLegendItems(next);
  };

  const changeLegendVisibility = (visible: boolean) => {
    if (visible === isLegendVisible) return;
    pushHistory();
    setIsLegendVisible(visible);
  };

  const changeLegendMode = (mode: LegendMode) => {
    if (mode === legendMode) return;
    pushHistory();
    setLegendMode(mode);
  };

  const changeLegendShowCounts = (show: boolean) => {
    if (show === legendShowCounts) return;
    pushHistory();
    setLegendShowCounts(show);
  };

  const updateLine = (updatedLine: LineData, saveHistory = true) => {
    if (saveHistory) pushHistory();
    setLines(prev => prev.map(line => (line.id === updatedLine.id ? updatedLine : line)));
  };

  /** Moves several pins as one undo step (group drag). */
  const movePinGroup = (ids: string[], dx: number, dy: number, withAnchor: boolean) => {
    pushHistory();
    setPins(prev => movePins(prev, ids, dx, dy, withAnchor));
  };

  const deleteSelected = () => {
    if (selectedPinIds.length > 0) {
      pushHistory();
      setPins(prev => removePins(prev, selectedPinIds));
      setSelectedPinIds([]);
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

  /** Click selects only that pin; toggle (Shift/Ctrl/Cmd+click) adds it to or removes it from the selection. */
  const selectPin = (id: string | null, functionIndex = -1, toggle = false) => {
    if (id && toggle) {
      const next = toggleInSelection(selectedPinIds, id);
      setSelectedPinIds(next);
      // The picked label belongs to the clicked pin, which is only the primary if it was added
      setSelectedFunctionIndex(primaryOf(next) === id ? functionIndex : -1);
    } else {
      setSelectedPinIds(id ? [id] : []);
      setSelectedFunctionIndex(functionIndex);
    }
    if (id) {
      setSelectedLineId(null);
      setSelectedImageId(null);
    }
  };

  const selectLine = (id: string | null) => {
    setSelectedLineId(id);
    if (id) {
      setSelectedPinIds([]);
      setSelectedImageId(null);
    }
  };

  const handlePinDoubleClick = (id: string, functionIndex: number) => {
    clearSelection();
    setSelectedPinIds([id]);
    setSelectedFunctionIndex(functionIndex);
    // Focus the editor of the double-clicked label (pin name or function) in the sidebar
    window.dispatchEvent(new CustomEvent<FocusSidebarInputDetail>('focus-sidebar-input', { detail: { functionIndex } }));
  };

  /** Adds pins to the selection (marquee), clearing any line or image selection. */
  const addPinsToSelection = (ids: string[]) => {
    setSelectedPinIds(addToSelection(selectedPinIds, ids));
    setSelectedFunctionIndex(-1);
    setSelectedLineId(null);
    setSelectedImageId(null);
  };

  const selectAllPins = () => {
    clearSelection();
    setSelectedPinIds(pins.map(p => p.id));
  };

  /** Adds copies of pins and selects them (paste/duplicate). The copies keep their relative layout. */
  const addPinCopies = (copies: PinData[]) => {
    // The clipboard can outlive the project it came from (e.g. pasting into a newly opened,
    // empty one): like any new pin, the copies fix the label scale
    fixLabelScale();
    pushHistory();
    setPins(prev => [...prev, ...copies]);
    clearSelection();
    setSelectedPinIds(copies.map(p => p.id));
  };

  const copySelection = () => {
    const selectedPins = pickPins(pins, selectedPinIds);
    const line = lines.find(l => l.id === selectedLineId);
    if (selectedPins.length > 0) {
      copiedPinsRef.current = selectedPins.map(p => ({ ...p }));
      copiedLineRef.current = null;
    } else if (line) {
      copiedLineRef.current = { ...line };
      copiedPinsRef.current = null;
    }
  };

  const pasteClipboard = () => {
    // Each paste is offset 20 units from the previous one, so repeated pastes chain.
    if (copiedPinsRef.current) {
      const copies = duplicatePins(copiedPinsRef.current);
      addPinCopies(copies);
      copiedPinsRef.current = copies;
    } else if (copiedLineRef.current) {
      const newLine = duplicateLine(copiedLineRef.current);
      fixLabelScale();
      pushHistory();
      setLines(prev => [...prev, newLine]);
      clearSelection();
      setSelectedLineId(newLine.id);
      copiedLineRef.current = newLine;
    }
  };

  /** Duplicates the selection in place (paste offset) without touching the clipboard. */
  const duplicateSelection = () => {
    const selectedPins = pickPins(pins, selectedPinIds);
    const line = lines.find(l => l.id === selectedLineId);
    if (selectedPins.length > 0) {
      addPinCopies(duplicatePins(selectedPins));
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
    const hasPins = selectedPinIds.length > 0;
    const line = lines.find(l => l.id === selectedLineId);
    const image = images.find(i => i.id === selectedImageId);
    if (!hasPins && !line && !image) return; // nothing selected: let the page scroll as usual
    e.preventDefault();
    if (!e.repeat) pushHistory();
    const withAnchor = e.altKey || (moveAnchorsWithSelection && selectedPinIds.length > 1);
    if (hasPins) setPins(prev => movePins(prev, selectedPinIds, dx, dy, withAnchor));
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
      alert(t.saveFailed);
    }
  };

  const handleQuickSave = async () => {
    if (!fileHandle) return handleSaveProject();
    try {
      await writeToHandle(fileHandle, getProjectJson());
    } catch (error) {
      console.error('Failed to quick save:', error);
      alert(t.quickSaveFailed);
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
      alert(t.invalidProject);
      return false;
    }

    // A new project starts with a clean slate: no undo into the previous one, no stale selection.
    resetHistory();
    clearSelection();
    setIsAddingPin(false);
    setIsAddingLine(false);
    stopHeaderTool();
    setIsPinTableOpen(false);
    copiedPinsRef.current = null;
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

    const { images: loaded, failed } = await loadProjectImages(data.images);
    setImages(loaded);
    setIsLoadingProject(false);
    if (failed > 0) {
      alert(t.projectImagesFailed(failed));
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
    // Restoring resets undo, so work done since startup would be gone for good
    const hasWork = images.length > 0 || pins.length > 0 || lines.length > 0;
    if (hasWork && !window.confirm(t.confirmRestore)) return;
    setRecoveredAutosave(null);
    // Once open, the restored project is autosaved as the current session. A snapshot that
    // no longer parses is useless, so it is dropped either way.
    void clearRecoveredAutosave();
    await openProject(JSON.stringify(record.project), null);
  };

  const handleDiscardAutosave = () => {
    setRecoveredAutosave(null);
    void clearRecoveredAutosave();
  };

  const handleExport = async (options: ExportOptions) => {
    try {
      // Built from project state, so selection outlines and handles never appear in the file
      const result = await exportDiagram(
        { images, pins, lines, labelScale: effectiveLabelScale, gapSize, anchorSize, legendItems, legendMode },
        { ...options, language },
      );
      if (!result.exported) alert(t.nothingToExport);
      else if (result.note) alert(result.note);
    } catch (e) {
      console.error('Export failed', e);
      alert(t.exportFailed(e instanceof Error ? e.message : String(e)));
    }
  };

  /** Downloads every pin with its functions as a CSV for Excel / Sheets. */
  const handleExportPinList = () => {
    const url = URL.createObjectURL(new Blob([buildPinListCsv(pins, language)], { type: PIN_LIST_MIME_TYPE }));
    const a = document.createElement('a');
    a.href = url;
    a.download = pinListFileName();
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Keyboard shortcuts ---
  const closeOverlay = (overlay: Overlay) => {
    if (overlay === 'help') setIsHelpOpen(false);
    else if (overlay === 'pinTable') setIsPinTableOpen(false);
    else if (overlay === 'library') setIsLibraryOpen(false);
    else if (overlay === 'headerPanel') setHeaderDraft(null);
    // The export menu handles its own Escape (and keeps it from reaching this handler)
  };

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    // Typing in a field keeps the browser's own behaviour (text undo, backspace, copy/paste)
    if (isEditableElement(document.activeElement)) return;

    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // No canvas shortcuts behind an open panel or dialog; Escape closes only the top-most one
    const overlay = topOverlay({
      isHelpOpen, isPinTableOpen, isExportMenuOpen, isLibraryOpen, isHeaderPanelOpen: !!headerDraft,
    });
    if (overlay) {
      if (e.key === 'Escape' || (overlay === 'help' && e.key === '?')) closeOverlay(overlay);
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
      stopHeaderTool();
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
    } else if (mod && key === 'a') {
      e.preventDefault();
      selectAllPins();
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

  // --- Bulk actions on a multi-pin selection (each is exactly one undo step) ---
  const layoutOf = (pin: PinData) => layoutPinLabels(pin, effectiveLabelScale, gapSize, measureLabelText);
  // Separate pins count as one row when their labels are within half a label height
  const combineTolerance = (LABEL_HEIGHT * effectiveLabelScale) / 2;

  /** Applies a bulk edit; one that changes nothing (e.g. aligning aligned pins) records no undo step. */
  const applyToSelectedPins = (transform: (pins: PinData[], ids: string[]) => PinData[], saveHistory = true) => {
    const next = transform(pins, selectedPinIds);
    if (deepEqual(next, pins)) return;
    if (saveHistory) pushHistory();
    setPins(next);
  };

  const combineSelectedRows = () => {
    const result = combineIntoRows(pins, selectedPinIds, layoutOf, combineTolerance);
    if (result.combinedRows === 0) return;
    pushHistory();
    setPins(result.pins);
    setSelectedPinIds(result.selectedIds);
    setSelectedFunctionIndex(-1);
  };

  // Lays out every selected pin; memoized so pan/zoom and unrelated re-renders don't redo it
  const multiPinStats = useMemo(() => {
    if (selectedPinIds.length < 2) return null;
    const layout = (pin: PinData) => layoutPinLabels(pin, effectiveLabelScale, gapSize, measureLabelText);
    const tolerance = (LABEL_HEIGHT * effectiveLabelScale) / 2;
    return {
      rowPitch: averageRowPitch(pins, selectedPinIds, layout),
      combinableRows: planCombineRows(pins, selectedPinIds, layout, tolerance).filter(row => row.length > 1).length,
    };
  }, [pins, selectedPinIds, effectiveLabelScale, gapSize]);

  const multiPinPanel = multiPinStats ? (
    <MultiPinPanel
      // A new selection starts with its own measured row pitch in the spacing field
      key={selectedPinIds.join(',')}
      pins={pickPins(pins, selectedPinIds)}
      rowPitch={multiPinStats.rowPitch}
      combinableRows={multiPinStats.combinableRows}
      moveAnchors={moveAnchorsWithSelection}
      onMoveAnchorsChange={setMoveAnchorsWithSelection}
      onAlignEdges={() => applyToSelectedPins((p, ids) => alignLabelEdgesToAnchor(p, ids, layoutOf))}
      onAlignTops={() => applyToSelectedPins(alignLabelTops)}
      onDistribute={() => applyToSelectedPins((p, ids) => distributeVertically(p, ids, layoutOf))}
      onApplyRowPitch={pitch => applyToSelectedPins((p, ids) => applyRowPitch(p, ids, pitch, layoutOf))}
      onSetColor={(color, saveHistory) => applyToSelectedPins((p, ids) => updatePins(p, ids, { color }), saveHistory)}
      onSetPwm={isPwm => applyToSelectedPins((p, ids) => updatePins(p, ids, { isPwm }))}
      onDelete={deleteSelected}
      onCombineRows={combineSelectedRows}
    />
  ) : null;

  const selectedPin = selectedPinIds.length === 1 ? pins.find(p => p.id === selectedPinId) ?? null : null;
  const selectedLine = lines.find(l => l.id === selectedLineId) || null;
  const selectedImage = images.find(img => img.id === selectedImageId) || null;
  const selectedHeader = selectedPin?.headerId ? headers.find(h => h.id === selectedPin.headerId) : undefined;
  // What 'auto' means for the header being set up (needs contentBounds, defined above)
  const autoHeaderSide = headerDraft ? headerSideFor(headerDraft.start, headerDraft.end) : 'right';
  // Stable ids keep the ghost pins mounted while the settings change
  let previewId = 0;
  const draftPins = buildDraftPins(effectiveLabelScale, () => `header-preview-${previewId++}`);

  return (
    <div className='h-screen w-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900'>
      <TopBar
        onImport={handleImageUpload}
        onAddPin={toggleAddPinMode}
        onAddLine={toggleAddLineMode}
        onDeletePin={deleteSelected}
        onRotateImage={handleRotateImage}
        onSave={handleSaveProject}
        onLoad={handleLoadProject}
        onExport={handleExport}
        isLegendVisible={isLegendVisible}
        isPinSelected={!!selectedPinId || !!selectedLineId || !!selectedImageId}
        isImageLoaded={images.length > 0}
        isAddingPin={isAddingPin}
        isAddingLine={isAddingLine}
        onToggleLibrary={() => setIsLibraryOpen(o => !o)}
        isLibraryOpen={isLibraryOpen}
        onAddHeader={toggleAddHeaderMode}
        isAddingHeader={isAddingHeader || !!headerDraft}
        onOpenPinTable={() => setIsPinTableOpen(true)}
        hasHeaders={headers.length > 0}
        onExportMenuOpenChange={setIsExportMenuOpen}
        onShowShortcuts={() => setIsHelpOpen(true)}
        onExportPinList={handleExportPinList}
        hasPins={pins.length > 0}
      />
      <ProductLibrary
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onImportProduct={handleImportProduct}
      />
      {isHelpOpen && <ShortcutsHelp onClose={() => setIsHelpOpen(false)} />}
      {isPinTableOpen && (
        <PinTableDialog
          headers={headers}
          initialHeaderId={selectedPin?.headerId ?? null}
          labelScale={effectiveLabelScale}
          onApply={applyTable}
          onClose={() => setIsPinTableOpen(false)}
        />
      )}
      <div className='flex flex-1 overflow-hidden'>
        <div className='relative flex flex-1 min-w-0'>
          {recoveredAutosave && (
            <RestoreBanner
              savedAt={recoveredAutosave.savedAt}
              onRestore={handleRestoreAutosave}
              onDiscard={handleDiscardAutosave}
            />
          )}
          {/* Welcome card on an empty project; hidden while something else is asking for attention */}
          {images.length === 0 && pins.length === 0 && lines.length === 0 && !recoveredAutosave && !isLibraryOpen
            && !isAddingPin && !isAddingLine && !isAddingHeader && (
            <EmptyState
              onImportImage={handleImageUpload}
              onOpenLibrary={() => setIsLibraryOpen(true)}
              onLoadProject={handleLoadProject}
            />
          )}
          {headerDraft && (
            <HeaderPanel
              settings={headerSettings}
              onChange={setHeaderSettings}
              resolvedSide={autoHeaderSide}
              onCreate={createHeader}
              onCancel={() => setHeaderDraft(null)}
            />
          )}
          <CanvasStage
            ref={stageRef}
            images={images}
            onUpdateImage={updateImage}
            selectedImageId={selectedImageId}
            onSelectImage={setSelectedImageId}
            pins={pins}
            selectedPinIds={selectedPinIds}
            selectedFunctionIndex={selectedFunctionIndex}
            onSelectPin={selectPin}
            onAddPinsToSelection={addPinsToSelection}
            onUpdatePin={updatePin}
            onMovePins={movePinGroup}
            moveAnchorsWithSelection={moveAnchorsWithSelection}
            onDoubleClickPin={handlePinDoubleClick}
            lines={lines}
            selectedLineId={selectedLineId}
            onSelectLine={selectLine}
            onUpdateLine={updateLine}
            isAddingLine={isAddingLine}
            onCreateLine={createLineAt}
            isAddingPin={isAddingPin}
            onCreatePin={createPinAt}
            isAddingHeader={isAddingHeader}
            headerCount={headerSettings.count}
            onPickHeader={pickHeader}
            headerDraft={headerDraft && { ...headerDraft, pins: draftPins }}
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
          multiPinPanel={multiPinPanel}
          selectedFunctionIndex={selectedFunctionIndex}
          onSelectFunctionIndex={setSelectedFunctionIndex}
          onUpdatePin={updatePin}
          selectedLine={selectedLine}
          onUpdateLine={updateLine}
          selectedImage={selectedImage}
          onUpdateImage={updateImage}
          onExportPinoutTemplate={handleExportPinoutTemplate}
          gapSize={gapSize}
          onGapSizeChange={setGapSize}
          legendItems={legendItems}
          onLegendItemsChange={changeLegendItems}
          isLegendVisible={isLegendVisible}
          onLegendVisibilityChange={changeLegendVisibility}
          legendMode={legendMode}
          onLegendModeChange={changeLegendMode}
          legendShowCounts={legendShowCounts}
          onLegendShowCountsChange={changeLegendShowCounts}
          anchorSize={anchorSize}
          onAnchorSizeChange={setAnchorSize}
          labelScale={effectiveLabelScale}
          onLabelScaleChange={changeLabelScale}
          selectedPinHeader={selectedHeader && selectedPin
            ? { index: selectedHeader.pins.indexOf(selectedPin), count: selectedHeader.pins.length }
            : null}
          onOpenPinTable={() => setIsPinTableOpen(true)}
        />
      </div>
    </div>
  );
}

export default App;
