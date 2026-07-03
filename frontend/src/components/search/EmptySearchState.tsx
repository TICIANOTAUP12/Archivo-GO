type EmptySearchStateProps = {
  query: string;
};

export function EmptySearchState({ query }: EmptySearchStateProps) {
  return (
    <section className="emptyState">
      <div className="emptyIllustration" aria-hidden="true">
        <span />
        <span />
      </div>
      <h2>No encontramos documentos para esta búsqueda.</h2>
      <p>
        Probá usando otros términos, una matrícula, un número de caso o una descripción más amplia que
        "{query}".
      </p>
    </section>
  );
}
