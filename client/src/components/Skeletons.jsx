// ── Skeleton building blocks + page-specific skeleton loaders ───────────

function S({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function SCircle({ className = 'w-10 h-10' }) {
  return <div className={`animate-pulse bg-gray-200 rounded-full ${className}`} />;
}

// ── Primitives ──────────────────────────────────────────────────────────

export function SkeletonKpiCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <SCircle className="w-10 h-10 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <S className="h-3 w-20" />
        <S className="h-5 w-16" />
      </div>
    </div>
  );
}

export function SkeletonKpiRow({ count = 4, cols = 'grid-cols-2 sm:grid-cols-4' }) {
  return (
    <div className={`grid ${cols} gap-3`}>
      {Array.from({ length: count }, (_, i) => <SkeletonKpiCard key={i} />)}
    </div>
  );
}

export function SkeletonChart({ height = 'h-[220px] sm:h-[280px]' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <S className="h-4 w-32" />
      <S className={`w-full rounded-lg ${height}`} />
    </div>
  );
}

export function SkeletonTableRow({ cols = 5 }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {Array.from({ length: cols }, (_, i) => (
        <S key={i} className={`h-3.5 flex-1 ${i === 0 ? 'max-w-[140px]' : ''}`} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        {Array.from({ length: cols }, (_, i) => (
          <S key={i} className="h-3 flex-1 bg-gray-300 rounded" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={i < rows - 1 ? 'border-b border-gray-50' : ''}>
          <SkeletonTableRow cols={cols} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonFilterBar() {
  return (
    <div className="flex items-center gap-3">
      <S className="h-9 flex-1 max-w-sm rounded-lg" />
      <S className="h-9 w-24 rounded-lg" />
      <S className="h-9 w-24 rounded-lg" />
    </div>
  );
}

export function SkeletonProductCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      <S className="w-full h-36 rounded-lg" />
      <S className="h-4 w-3/4" />
      <S className="h-3 w-1/2" />
      <div className="flex justify-between">
        <S className="h-3 w-16" />
        <S className="h-3 w-12" />
      </div>
    </div>
  );
}

export function SkeletonProductGrid({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, i) => <SkeletonProductCard key={i} />)}
    </div>
  );
}

function SkeletonDetailHeader() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <SCircle className="w-12 h-12" />
        <div className="flex-1 space-y-2">
          <S className="h-5 w-48" />
          <S className="h-3 w-32" />
        </div>
        <S className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}

function SkeletonStatsRow({ count = 4 }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-${count} gap-3`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <S className="h-3 w-16" />
          <S className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

// ── Page-specific skeletons ─────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <S className="h-7 w-48" />
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <S className="h-3 w-24 mb-3" />
        <S className="h-9 w-full max-w-md rounded-lg" />
      </div>
      <SkeletonKpiRow count={5} cols="grid-cols-2 sm:grid-cols-5" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonChart />
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  );
}

export function OrdersInsightsSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonKpiRow count={4} />
      <SkeletonChart />
      <SkeletonTable rows={3} cols={4} />
    </div>
  );
}

export function OrdersListSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonFilterBar />
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <S className="h-5 w-40" />
                <S className="h-3 w-24" />
              </div>
              <S className="h-8 w-28 rounded-lg" />
            </div>
            {[1, 2].map(i => (
              <div key={i} className="bg-gray-50 rounded-lg px-3 py-3 space-y-2">
                <S className="h-4 w-48" />
                <S className="h-3 w-32" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <S className="h-4 w-28" />
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <SCircle className="w-6 h-6" />
                <S className="h-3 flex-1 max-w-xs" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <S className="h-4 w-24" />
            <S className="h-3 w-full" />
            <S className="h-3 w-3/4" />
            <S className="h-3 w-full" />
            <S className="h-3 w-1/2" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <S className="h-4 w-32" />
            <S className="h-3 w-full" />
            <S className="h-3 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeadsInsightsSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonKpiRow count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      <SkeletonTable rows={4} cols={4} />
    </div>
  );
}

export function LeadsListSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonFilterBar />
      <SkeletonTable rows={8} cols={5} />
    </div>
  );
}

export function LeadDetailSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <SkeletonDetailHeader />
      <SkeletonStatsRow count={4} />
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <S className="h-4 w-36" />
        {[1, 2].map(i => (
          <div key={i} className="flex items-center gap-3 py-2">
            <S className="h-4 w-32" />
            <S className="h-5 w-14 rounded-full" />
            <S className="h-4 w-16" />
            <S className="h-4 w-16" />
            <S className="h-4 w-10" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
        <S className="h-4 w-16" />
        <S className="h-3 w-full" />
        <S className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export function CustomersInsightsSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonKpiRow count={3} cols="grid-cols-2 sm:grid-cols-3" />
      <SkeletonChart />
      <SkeletonTable rows={4} cols={4} />
    </div>
  );
}

export function CustomersListSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonKpiRow count={3} cols="grid-cols-2 sm:grid-cols-3" />
      <SkeletonFilterBar />
      <SkeletonTable rows={8} cols={5} />
    </div>
  );
}

export function CustomerDetailSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <SCircle className="w-14 h-14" />
          <div className="flex-1 space-y-2">
            <S className="h-5 w-40" />
            <S className="h-3 w-28" />
            <S className="h-3 w-48" />
          </div>
          <S className="h-8 w-16 rounded-lg" />
        </div>
      </div>
      <SkeletonStatsRow count={4} />
      <div className="space-y-2">
        <S className="h-4 w-28" />
        <SkeletonTable rows={3} cols={5} />
      </div>
      <div className="space-y-2">
        <S className="h-4 w-28" />
        <SkeletonTable rows={4} cols={5} />
      </div>
    </div>
  );
}

export function InventoryInsightsSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonKpiRow count={4} />
      <SkeletonChart />
      <SkeletonTable rows={4} cols={4} />
    </div>
  );
}

export function InventoryListSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonFilterBar />
      <SkeletonProductGrid count={8} />
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start gap-4">
          <S className="w-24 h-24 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <S className="h-5 w-48" />
            <S className="h-3 w-32" />
            <div className="flex gap-2 mt-2">
              <S className="h-5 w-16 rounded-full" />
              <S className="h-5 w-20 rounded-full" />
            </div>
          </div>
          <S className="h-8 w-16 rounded-lg" />
        </div>
      </div>
      <SkeletonStatsRow count={4} />
      <SkeletonTable rows={5} cols={5} />
    </div>
  );
}

export function ArchivedTableSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonFilterBar />
      <SkeletonTable rows={6} cols={4} />
    </div>
  );
}
