import { useEffect, useRef, useState } from 'react';

/**
 * RevealOnScroll
 * High-performance IntersectionObserver wrapper for scroll-driven fade in / fade out transitions.
 * When in viewport: fades in and glides to normal position.
 * When scrolling past top or bottom: smoothly fades out.
 */
export default function RevealOnScroll({
  children,
  className = '',
  delay = 0,
  duration = 700,
  direction = 'up', // 'up' | 'down' | 'left' | 'right'
  threshold = 0.05,
  rootMargin = '0px 0px -40px 0px',
  once = false,
  fadeOnLeave = true,
  enabled = true,
}) {
  const [status, setStatus] = useState('hidden-bottom'); // 'hidden-bottom' | 'visible' | 'hidden-top'
  const ref = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const el = ref.current;
    if (!el) return;

    // Check immediate visibility on mount (for above-the-fold content)
    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < windowHeight && rect.bottom > 0) {
      const timer = setTimeout(() => {
        setStatus('visible');
      }, delay || 40);
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
          // Element left viewport: check if it exited out the top or bottom
          if (entry.boundingClientRect.bottom <= 0) {
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
  }, [threshold, rootMargin, once, fadeOnLeave, enabled, delay]);

  let transform = 'translateY(0) translateX(0)';
  let opacity = 1;

  if (status === 'hidden-bottom') {
    if (direction === 'down') {
      transform = 'translateY(-28px)';
    } else if (direction === 'left') {
      transform = 'translateX(-32px)';
    } else if (direction === 'right') {
      transform = 'translateX(32px)';
    } else {
      transform = 'translateY(32px)';
    }
    opacity = 0;
  } else if (status === 'hidden-top') {
    transform = 'translateY(-32px)';
    opacity = 0;
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
