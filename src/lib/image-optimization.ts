/**
 * Image optimization utilities for Next.js Image component.
 * Provides helpers for responsive images, lazy loading, and format optimization.
 */

export interface ImageOptimizationConfig {
  sizes?: string;
  priority?: boolean;
  quality?: number;
  placeholder?: "blur" | "empty";
}

/**
 * Get responsive image sizes for different breakpoints.
 * Optimizes for mobile-first design.
 */
export const getResponsiveSizes = (maxWidth: number = 1200): string => {
  return [
    "(max-width: 640px) 100vw",
    "(max-width: 1024px) 90vw",
    `${Math.min(maxWidth, 1200)}px`,
  ].join(", ");
};

/**
 * Get optimized image configuration for common use cases.
 */
export const imageConfigs = {
  thumbnail: {
    sizes: "(max-width: 640px) 100px, 150px",
    quality: 75,
    placeholder: "blur" as const,
  },
  card: {
    sizes: getResponsiveSizes(400),
    quality: 80,
    placeholder: "blur" as const,
  },
  hero: {
    sizes: getResponsiveSizes(1200),
    quality: 85,
    placeholder: "blur" as const,
    priority: true,
  },
  icon: {
    sizes: "64px",
    quality: 90,
  },
} as const;

/**
 * Generate srcSet for responsive images.
 * Supports WebP and fallback formats.
 */
export const generateSrcSet = (
  basePath: string,
  widths: number[] = [320, 640, 960, 1280, 1920],
): string => {
  return widths
    .map((width) => `${basePath}?w=${width}&q=75 ${width}w`)
    .join(", ");
};

/**
 * Get image loader for CDN optimization.
 * Supports dynamic image resizing and format conversion.
 */
export const imageLoader = (
  src: string,
  width: number,
  quality: number = 75,
): string => {
  // If using a CDN, construct the optimized URL
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  if (cdnUrl && !src.startsWith("http")) {
    const params = new URLSearchParams({
      w: width.toString(),
      q: quality.toString(),
      f: "webp", // Request WebP format
    });
    return `${cdnUrl}${src}?${params.toString()}`;
  }
  return src;
};

/**
 * Preload critical images for better LCP.
 */
export const preloadImage = (src: string, as: "image" = "image"): void => {
  if (typeof window === "undefined") return;

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = as;
  link.href = src;
  link.type = "image/webp";
  document.head.appendChild(link);
};

/**
 * Lazy load images with Intersection Observer.
 */
export const lazyLoadImage = (
  img: HTMLImageElement,
  options: IntersectionObserverInit = { rootMargin: "50px" },
): void => {
  if (!("IntersectionObserver" in window)) {
    // Fallback for browsers without IntersectionObserver
    img.src = img.dataset.src || "";
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        img.src = img.dataset.src || "";
        img.classList.add("loaded");
        observer.unobserve(img);
      }
    });
  }, options);

  observer.observe(img);
};

/**
 * Get image dimensions for aspect ratio preservation.
 */
export const getImageDimensions = (
  aspectRatio: "square" | "video" | "portrait" | "landscape" = "square",
): { width: number; height: number } => {
  const ratios = {
    square: { width: 1, height: 1 },
    video: { width: 16, height: 9 },
    portrait: { width: 3, height: 4 },
    landscape: { width: 4, height: 3 },
  };
  return ratios[aspectRatio];
};
