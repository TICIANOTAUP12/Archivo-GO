import type { ReactNode } from 'react';

type MainContainerProps = {
  children: ReactNode;
};

export function MainContainer({ children }: MainContainerProps) {
  return <main className="shell">{children}</main>;
}
