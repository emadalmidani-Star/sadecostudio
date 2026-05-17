import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
};

export default function EmptyState({ icon: Icon = SearchX, title = "No results", description, actionLabel, actionTo, onAction }: Props) {
  return (
    <Card className="p-12 text-center border-dashed shadow-card">
      <Icon className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
      <h3 className="font-serif text-2xl mb-1">{title}</h3>
      {description && <p className="text-muted-foreground mb-5">{description}</p>}
      {actionLabel && (actionTo ? (
        <Button asChild><Link to={actionTo}>{actionLabel}</Link></Button>
      ) : (
        <Button onClick={onAction}>{actionLabel}</Button>
      ))}
    </Card>
  );
}
