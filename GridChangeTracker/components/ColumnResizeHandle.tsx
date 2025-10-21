import * as React from 'react';
import { useState, useRef, useCallback } from 'react';

interface IColumnResizeHandleProps {
    columnKey: string;
    onResize: (columnKey: string, deltaX: number) => void;
}

export const ColumnResizeHandle: React.FC<IColumnResizeHandleProps> = ({ columnKey, onResize }) => {
    const [isResizing, setIsResizing] = useState(false);
    const startX = useRef(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        startX.current = e.clientX;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing && startX.current === 0) return;
            const deltaX = e.clientX - startX.current;
            if (Math.abs(deltaX) > 0) {
                onResize(columnKey, deltaX);
                startX.current = e.clientX;
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            startX.current = 0;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.classList.remove('grid-resizing');
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.classList.add('grid-resizing');
    }, [columnKey, onResize, isResizing]);

    return (
        <div
            className={`column-resize-handle ${isResizing ? 'resizing' : ''}`}
            onMouseDown={handleMouseDown}
            aria-label={`Resize ${columnKey} column`}
            role="separator"
            aria-orientation="vertical"
            tabIndex={0}
            style={{
                position: 'absolute',
                right: -2,
                top: 0,
                width: 4,
                height: '100%',
                cursor: 'col-resize',
                background: isResizing ? '#0078d4' : 'transparent',
                zIndex: 10,
                userSelect: 'none'
            }}
        />
    );
};