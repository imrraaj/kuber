import { ReactNode } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function Panel({ title, children, className = '', actions }: PanelProps) {
  return (
    <div className={`panel flex flex-col ${className}`}>
      <div className="panel-header flex items-center justify-between">
        <span>{title}</span>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="panel-content flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
