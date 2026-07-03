const skeletonRows = ['first', 'second', 'third'];

export function SearchSkeleton() {
  return (
    <div className="skeletonList" aria-label="Cargando resultados">
      {skeletonRows.map((row) => (
        <div className="skeletonCard" key={row}>
          <span className="skeletonIcon" />
          <div>
            <span className="skeletonLine wide" />
            <span className="skeletonLine medium" />
            <span className="skeletonLine narrow" />
          </div>
        </div>
      ))}
    </div>
  );
}
