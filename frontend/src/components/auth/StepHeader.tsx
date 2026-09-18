import { useEffect, useRef } from 'react';

export function StepHeader({ title, description, icon = 'home', stepKey = title }: {
  title: string; description?: string; icon?: string; stepKey?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [stepKey]);
  return <header className="step-heading">
    <span className="step-icon material-symbols-outlined" aria-hidden="true">{icon}</span>
    <h1 ref={heading} tabIndex={-1}>{title}</h1>
    {description && <p>{description}</p>}
  </header>;
}
