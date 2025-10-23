import * as React from 'react';

interface IFillHandleProps {
    visible: boolean;
    onDragStart: (e: React.MouseEvent) => void;
}

export const FillHandle: React.FC<IFillHandleProps> = ({ visible, onDragStart }) => {
    if (!visible) return null;

    const handleMouseDown = (e: React.MouseEvent) => {
        console.log('[FillHandle] Mouse down event triggered');
        e.preventDefault();
        e.stopPropagation();
        onDragStart(e);
    };

    return (
        <div
            className="fill-handle"
            onMouseDown={handleMouseDown}
            title="Drag up or down to fill cells"
            style={{
                position: 'absolute',
                width: '7px',
                height: '7px',
                backgroundColor: '#0078d4',
                border: '1px solid white',
                right: '-4px',
                bottom: '-4px',
                cursor: 'crosshair',
                zIndex: 100
            }}
        />
    );
};