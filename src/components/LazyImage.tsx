import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = React.ImgHTMLAttributes<HTMLImageElement> & { fallback?: React.ReactNode };

export default function LazyImage({ className, fallback, onLoad, ...rest }: Props) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={cn("relative w-full h-full", className)}>
      {!loaded && (fallback ?? <Skeleton className="absolute inset-0 w-full h-full" />)}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        loading="lazy"
        decoding="async"
        {...rest}
        onLoad={(e) => { setLoaded(true); onLoad?.(e); }}
        className={cn("w-full h-full object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
