import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface DashboardTransitionProps {
  children: ReactNode;
  viewMode: 'overview' | 'portfolio-detail' | 'asset-detail';
  className?: string;
}

// Animation variants for smooth transitions
const pageVariants = {
  initial: {
    opacity: 0,
    x: 20,
    scale: 0.98
  },
  in: {
    opacity: 1,
    x: 0,
    scale: 1
  },
  out: {
    opacity: 0,
    x: -20,
    scale: 0.98
  }
};

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.3
};

export function DashboardTransition({ 
  children, 
  viewMode, 
  className = '' 
}: DashboardTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewMode}
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Slide transition for breadcrumb changes
export function BreadcrumbTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// Fade transition for content areas
export function ContentTransition({ 
  children, 
  isVisible = true 
}: { 
  children: ReactNode; 
  isVisible?: boolean; 
}) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}