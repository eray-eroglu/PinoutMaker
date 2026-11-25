import { useState, useEffect, useMemo } from 'react';
import { X, Search, Package, ChevronDown, ImagePlus, Loader2, AlertCircle, BookOpen } from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '../supabaseClient';
import { parsePinoutTemplate } from '../utils/pinoutTemplate';
import { defineMessages, useMessages } from '../i18n';

// Product names and categories come from the library database and are shown as they are
const MESSAGES = defineMessages({
  en: {
    title: 'Product Library',
    productCount: (n: number) => `${n} products`,
    close: 'Close',
    searchPlaceholder: 'Search products...',
    allCategories: 'All',
    loading: 'Loading...',
    unavailable: 'Library unavailable',
    notConfigured: 'The product library is not configured for this site.',
    loadFailed: "Couldn't load products",
    loadFailedFallback: 'Failed to load data.',
    retry: 'Retry',
    noProducts: 'No products found',
    pinoutBadge: 'Pinout',
    imageAndPinout: 'Image + pinout',
    imageOnly: 'Image only',
    addToCanvas: 'Add to Canvas',
  },
  tr: {
    title: 'Ürün Kütüphanesi',
    productCount: (n: number) => `${n} ürün`,
    close: 'Kapat',
    searchPlaceholder: 'Ürün ara...',
    allCategories: 'Tümü',
    loading: 'Yükleniyor...',
    unavailable: 'Kütüphane kullanılamıyor',
    notConfigured: 'Ürün kütüphanesi bu site için yapılandırılmamış.',
    loadFailed: 'Ürünler yüklenemedi',
    loadFailedFallback: 'Veriler yüklenemedi.',
    retry: 'Tekrar dene',
    noProducts: 'Ürün bulunamadı',
    pinoutBadge: 'Pinout',
    imageAndPinout: 'Görsel + pinout',
    imageOnly: 'Yalnızca görsel',
    addToCanvas: 'Tuvale ekle',
  },
});

export interface Product {
  id: number;
  name: string;
  category: string;
  image_url: string;
  /** Optional pinout template (jsonb). Untrusted: validate with parsePinoutTemplate before use. */
  pinout?: unknown;
}

interface ProductLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  /** withPinout is true only for products that offered a valid pinout and the user chose it. */
  onImportProduct: (product: Product, withPinout: boolean) => void;
}

export const ProductLibrary = ({ isOpen, onClose, onImportProduct }: ProductLibraryProps) => {
  const t = useMessages(MESSAGES);
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // null = all categories
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const isConfigured = isSupabaseConfigured;
  const loading = status === 'loading';

  const fetchProducts = async () => {
    if (!isSupabaseConfigured) {
      void getSupabase(); // logs the setup hint once
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      // supabase-js is loaded on first use; a failed chunk load lands in the error state below
      const supabase = await getSupabase();
      if (!supabase) return;
      const { data, error: supabaseError } = await supabase
        .from('products')
        .select('*')
        .order('name')
        // Fail fast when Supabase is unreachable instead of retrying with a spinner forever
        .retry(false)
        .abortSignal(AbortSignal.timeout(10_000));

      if (supabaseError) throw supabaseError;
      const rows = (data ?? []) as Product[];
      setProducts(rows);
      // Auto-expand all categories
      setExpandedCategories(new Set(rows.map(p => p.category)));
      setStatus('ready');
    } catch (err: unknown) {
      // Supabase returns plain { message } objects, not Error instances
      const message = typeof err === 'object' && err !== null && 'message' in err ? String(err.message) : '';
      // null = no message from the server; the fallback is shown in the current language
      setError(message || null);
      setStatus('error');
    }
  };

  // Load once, the first time the panel opens; "Retry" refetches after an error.
  useEffect(() => {
    if (isOpen && status === 'idle') fetchProducts();
  }, [isOpen, status]);

  const categories = [null, ...Array.from(new Set(products.map(p => p.category))).sort()];

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === null || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const grouped = filtered.reduce<Record<string, Product[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed z-40 bg-black/10"
          style={{ top: 56, left: 0, right: 0, bottom: 0 }}
          onClick={onClose}
        />
      )}

      {/* Slide-in Panel — matches Sidebar style */}
      <div
        className="fixed left-0 flex flex-col bg-gray-50 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600"
        style={{
          top: 56,
          bottom: 0,
          zIndex: 50,
          width: '280px',
          boxShadow: isOpen ? '2px 0 12px rgba(0,0,0,0.08)' : 'none',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-blue-600" />
              <div>
                <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">{t.title}</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">{t.productCount(products.length)}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              title={t.close}
              aria-label={t.close}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 pl-8 text-sm outline-none focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map(cat => (
              <button
                key={cat === null ? 'all' : `category:${cat}`}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-0.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                {cat ?? t.allCategories}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Loader2 size={22} className="text-blue-500 animate-spin" />
              <span className="text-sm text-gray-400 dark:text-gray-500">{t.loading}</span>
            </div>
          )}

          {/* Not configured */}
          {!isConfigured && (
            <div className="mx-3 mt-3 p-3 rounded border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={14} className="text-amber-500" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{t.unavailable}</span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">{t.notConfigured}</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="mx-3 mt-3 p-3 rounded border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle size={14} className="text-red-500" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">{t.loadFailed}</span>
              </div>
              <p className="text-xs text-red-500 dark:text-red-400 mb-2">{error ?? t.loadFailedFallback}</p>
              <button
                onClick={fetchProducts}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline cursor-pointer"
              >
                {t.retry}
              </button>
            </div>
          )}

          {/* Empty */}
          {status === 'ready' && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Package size={28} className="text-gray-300 dark:text-gray-600" />
              <span className="text-sm text-gray-400 dark:text-gray-500">{t.noProducts}</span>
            </div>
          )}

          {/* Grouped Products */}
          {status === 'ready' && Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {category}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                    {items.length}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-gray-400 dark:text-gray-500 transition-transform ${expandedCategories.has(category) ? 'rotate-0' : '-rotate-90'}`}
                  />
                </div>
              </button>

              {/* Product Cards */}
              {expandedCategories.has(category) && (
                <div className="px-3 pb-2 space-y-2">
                  {items.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onImport={onImportProduct}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// --- Individual Product Card ---
const ProductCard = ({ product, onImport }: { product: Product; onImport: (p: Product, withPinout: boolean) => void }) => {
  const t = useMessages(MESSAGES);
  const [imgError, setImgError] = useState(false);
  // Only advertise a pinout that will actually import; a broken one falls back to image-only.
  const hasPinout = useMemo(() => parsePinoutTemplate(product.pinout) !== null, [product.pinout]);

  return (
    <div className="rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all overflow-hidden group">
      {/* Thumbnail */}
      <div className="w-full h-24 bg-gray-100 flex items-center justify-center overflow-hidden">
        {!imgError && product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <Package size={24} className="text-gray-300 dark:text-gray-600" />
        )}
      </div>

      {/* Info + Button */}
      <div className="px-3 py-2">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-tight">{product.name}</p>
          {hasPinout && (
            <span className="shrink-0 text-[10px] bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-1.5 py-0.5 rounded-full font-medium">
              {t.pinoutBadge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">{product.category}</p>
        {hasPinout ? (
          <div className="space-y-1.5">
            <button
              onClick={() => onImport(product, true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium border border-blue-600 text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <ImagePlus size={12} />
              {t.imageAndPinout}
            </button>
            <button
              onClick={() => onImport(product, false)}
              className="w-full flex items-center justify-center gap-1.5 py-1 rounded text-xs font-medium border border-gray-300 text-gray-600 bg-white hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:bg-gray-900 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              {t.imageOnly}
            </button>
          </div>
        ) : (
          <button
            onClick={() => onImport(product, false)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium border border-blue-200 text-blue-600 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-900/40 hover:bg-blue-600 hover:text-white hover:border-blue-600 dark:hover:bg-blue-600 dark:hover:text-white dark:hover:border-blue-600 transition-colors cursor-pointer"
          >
            <ImagePlus size={12} />
            {t.addToCanvas}
          </button>
        )}
      </div>
    </div>
  );
};
