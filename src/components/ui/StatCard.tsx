import type { ComponentType, ReactNode, SVGProps } from 'react';
import type { LucideIcon } from 'lucide-react';

type IconComponent =
  | LucideIcon
  | ComponentType<SVGProps<SVGSVGElement> & { size?: number; color?: string }>;

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: IconComponent;
  tone?: 'default' | 'positive' | 'negative' | 'warn';
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: StatCardProps) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">
          <Icon size={18} />
        </span>
      </div>
      <strong className="stat-value">{value}</strong>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </article>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
