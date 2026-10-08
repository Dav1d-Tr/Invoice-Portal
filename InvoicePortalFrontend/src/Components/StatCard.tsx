import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  iconColor: string;
  iconBackground: string;
  description?: string;
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBackground,
  description,
}: StatCardProps) => {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBackground}`}
          aria-hidden="true"
        >
          <Icon
            size={21}
            strokeWidth={1.8}
            className={iconColor}
          />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-[#878d91]">
            {title}
          </h2>

          <strong className="text-2xl font-bold text-slate-800">
            {value}
          </strong>
        </div>
      </div>

      {description && (
        <p className="mt-2 text-sm text-slate-500">
          {description}
        </p>
      )}
    </article>
  );
};

export default StatCard;