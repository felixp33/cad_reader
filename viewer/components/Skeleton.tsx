// Placeholder shapes shown while data loads.
export const Skeleton = ({ w, h = 14, style }: { w?: number | string; h?: number | string; style?: React.CSSProperties }) => (
  <div className="skeleton" aria-hidden style={{ width: w, height: h, ...style }} />
);

export const SkeletonRows = ({ rows = 6 }: { rows?: number }) => (
  <div className="skeleton-rows" role="status" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => <Skeleton key={i} h={16} w={`${92 - ((i * 17) % 38)}%`} />)}
  </div>
);

export const SkeletonCards = ({ count = 6 }: { count?: number }) => (
  <div className="grid" role="status" aria-label="Loading">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="skeleton-card">
        <Skeleton h="auto" style={{ aspectRatio: '3 / 2' }} />
        <div className="skeleton-card-body"><Skeleton h={16} w="70%" /><Skeleton h={12} w="45%" /></div>
      </div>
    ))}
  </div>
);

// Over a 3D canvas while the machine loads.
export const StageLoading = () => <div className="stage-loading" role="status" aria-label="Loading model"><div className="skeleton" /></div>;
