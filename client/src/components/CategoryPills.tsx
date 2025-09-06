import { CATEGORY_VALUES, CATEGORY_LABEL, CATEGORY_ICON, type Category } from "@shared/categories";
import { Button } from "@/components/ui/button";

interface CategoryPillsProps {
  value: Category | undefined;
  onChange: (category: Category) => void;
}

export function CategoryPills({ value, onChange }: CategoryPillsProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {CATEGORY_VALUES.filter(c => c !== "general").map((category) => {
        const isActive = value === category;
        return (
          <Button
            key={category}
            type="button"
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(category)}
            className={isActive ? "" : "hover:bg-gray-50"}
            data-testid={`category-pill-${category}`}
          >
            <span className="mr-1">{CATEGORY_ICON[category]}</span>
            {CATEGORY_LABEL[category]}
          </Button>
        );
      })}
    </div>
  );
}