/**
 * SkeletonLoader - Reusable skeleton loading component
 */

import React from 'react';
import './SkeletonLoader.css';

interface SkeletonLoaderProps {
  type?: 'text' | 'circle' | 'rectangle' | 'photo' | 'list-item';
  width?: string;
  height?: string;
  count?: number;
  className?: string;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'rectangle',
  width,
  height,
  count = 1,
  className = '',
}) => {
  const getSkeletonClass = () => {
    switch (type) {
      case 'text':
        return 'skeleton skeleton-text';
      case 'circle':
        return 'skeleton skeleton-circle';
      case 'photo':
        return 'skeleton skeleton-photo';
      case 'list-item':
        return 'skeleton skeleton-list-item';
      case 'rectangle':
      default:
        return 'skeleton skeleton-rectangle';
    }
  };

  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  const skeletons = Array.from({ length: count }, (_, index) => (
    <div
      key={index}
      className={`${getSkeletonClass()} ${className}`}
      style={style}
      aria-hidden="true"
    />
  ));

  return <>{skeletons}</>;
};

export default SkeletonLoader;
