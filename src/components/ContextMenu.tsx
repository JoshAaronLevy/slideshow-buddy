import { useEffect, useState, CSSProperties } from 'react';
import './ContextMenu.css';

interface MenuItem {
  label: string;
  action: () => void;
  destructive?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  items: MenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ items, x, y, onClose }) => {
  useEffect(() => {
    const handleClick = () => onClose();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const style: CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
  };

  return (
    <div className="context-menu" style={style} onClick={(e) => e.stopPropagation()}>
      {items.map((item, index) => (
        item.separator ? (
          <div key={index} className="context-menu-separator" />
        ) : (
          <div
            key={index}
            className={`context-menu-item ${item.destructive ? 'destructive' : ''}`}
            onClick={() => {
              item.action();
              onClose();
            }}
          >
            {item.label}
          </div>
        )
      ))}
    </div>
  );
};

export default ContextMenu;