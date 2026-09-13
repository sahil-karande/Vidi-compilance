import { useEffect, useRef, useState } from 'react';

/**
 * RevealOnScroll
 * High-performance IntersectionObserver wrapper for scroll-driven fade in / fade up transitions.
 * When in viewport: fades in and glides to normal position.
 * When scrolling past: smoothly fades up/out.
 */
export default function RevealOnScroll({
  children,
  className = '',
  delay = 0,
  duration = 700,
  threshold = 0.1,
  rootMargin = '0px 0px -50px 0px',
  once = false,
  fadeOnLeave = true,
}) {
  const [status, setStatus] = useState('hidden-bottom'); // 'hidden-bottom' | 'visible' | 'hidden-top'
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Check immediate visibility on mount (for above-the-fold content)
    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < windowHeight && rect.bottom > 0) {
      // Small timeout allows initial render paint so transition can be seen smoothly
      const timer = setTimeout(() => {
        setStatus('visible');
      }, 50);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatus('visible');
          if (once) {
            observer.unobserve(el);
          }
        } else if (!once && fadeOnLeave) {
          // If element scrolled above viewport top
          if (entry.boundingClientRect.top < 0) {
            setStatus('hidden-top');
          } else {
            setStatus('hidden-bottom');
          }
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once, fadeOnLeave]);

  let transform = 'translateY(0)';
  let opacity = 1;

  if (status === 'hidden-bottom') {
    transform = 'translateY(36px)';
    opacity = 0;
  } else if (status === 'hidden-top') {
    transform = 'translateY(-20px)';
    opacity = 0.2;
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity,
        transform,
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}
