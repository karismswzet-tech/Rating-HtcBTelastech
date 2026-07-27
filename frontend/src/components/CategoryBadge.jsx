import React from "react";
import { CATEGORY_STYLE } from "@/lib/astm";

export default function CategoryBadge({ category, testid }) {
  const style = CATEGORY_STYLE[category] || CATEGORY_STYLE["Corrosion"];
  return (
    <span
      data-testid={testid || "category-badge"}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${style.bg} ${style.text} ${style.ring}`}
    >
      {category}
    </span>
  );
}
