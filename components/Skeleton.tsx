import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-zinc-700 rounded ${className}`} />
);

export const CodeSkeleton: React.FC = () => (
  <div className="space-y-2 p-4">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-4 w-5/6" />
    <Skeleton className="h-4 w-2/3" />
    <Skeleton className="h-4 w-4/5" />
    <Skeleton className="h-4 w-1/3" />
  </div>
);

export const ReviewSkeleton: React.FC = () => (
  <div className="space-y-3 p-4">
    <div className="flex items-center gap-2">
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="h-4 w-32" />
    </div>
    <Skeleton className="h-20 w-full rounded-lg" />
    <div className="flex items-center gap-2">
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="h-4 w-28" />
    </div>
    <Skeleton className="h-20 w-full rounded-lg" />
  </div>
);

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon, 
  title, 
  description, 
  action 
}) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div className="text-slate-300 dark:text-zinc-600 mb-3">
      {icon}
    </div>
    <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
      {title}
    </h3>
    {description && (
      <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mb-4">
        {description}
      </p>
    )}
    {action}
  </div>
);
