import React, { useState, useRef, useEffect } from 'react';
import type { Room, Unit, Tool, RAGBase } from '../../types';
import { RoomName, PROTECTED_UNITS } from '../../constants';
import UnitDetailView from '../units/UnitDetailView';
import Icon from '../ui/Icon';
import ToolManagement from '../tools/ToolManagement';

interface MainContentProps {
  activeRoom: Room;
  activeUnit: Unit | null;
  allTools: Tool[];
  ragBases: RAGBase[];
  onSelectUnit: (unitId: string) => void;
  onAddUnit: (roomId: string, type: 'Standard' | 'RAG' | 'Code RAG' | 'Drive') => void;
  onUpdateUnit: (unit: Unit) => void;
  onDeleteUnit: (unitId: string) => void;
  onAddTool: (tool: Omit<Tool, 'id'>) => void;
  onDeleteTool: (toolId: string) => void;
  onUpdateRagBase: (base: RAGBase) => void;
}

const UnitCard: React.FC<{ unit: Unit; onSelect: () => void; onDelete: () => void; isActive: boolean }> = ({ unit, onSelect, onDelete, isActive }) => {
  const isProtected = PROTECTED_UNITS.includes(unit.name);
  return (
    <div className={`bg-surface p-4 rounded-lg border-2 transition-all cursor-pointer ${isActive ? 'border-primary' : 'border-border-color hover:border-primary/50'}`}>
      <div className="flex justify-between items-start">
        <div onClick={onSelect} className="flex-grow">
          <h4 className="font-bold text-text-primary">{unit.name}</h4>
          <p className="text-xs text-text-secondary bg-surface-light inline-block px-2 py-1 rounded mt-1">{unit.type}</p>
        </div>
        {!isProtected && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-text-secondary hover:text-red-500 transition-colors">
            <Icon name="trash" className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const AddUnitButton: React.FC<{ roomId: string; onAdd: MainContentProps['onAddUnit'] }> = ({ roomId, onAdd }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleAdd = (type: 'Standard' | 'RAG' | 'Code RAG' | 'Drive') => {
        onAdd(roomId, type);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="flex items-center space-x-2 bg-primary text-white px-3 py-1.5 text-sm font-semibold rounded-lg hover:bg-primary/80 transition-colors"
            >
                <Icon name="plus" className="w-4 h-4" />
                <span>Add Unit</span>
                <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} className="w-4 h-4" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-light border border-border-color rounded-lg shadow-lg z-10">
                    <button onClick={() => handleAdd('Standard')} className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface">Standard Unit</button>
                    <button onClick={() => handleAdd('Drive')} className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface">Drive Unit</button>
                    <button onClick={() => handleAdd('RAG')} className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface">RAG Unit</button>
                    <button onClick={() => handleAdd('Code RAG')} className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface">Code RAG Unit</button>
                </div>
            )}
        </div>
    );
};


const MainContent: React.FC<MainContentProps> = (props) => {
  const { 
      activeRoom, activeUnit, onSelectUnit, onAddUnit, onUpdateUnit, 
      onDeleteUnit, allTools, onAddTool, onDeleteTool, ragBases, onUpdateRagBase
  } = props;
  
  if (activeRoom.name === RoomName.Tools) {
    return (
      <main className="flex-1 bg-background overflow-y-auto">
        <ToolManagement
          activeRoom={activeRoom}
          tools={activeRoom.tools || []}
          onAddTool={onAddTool}
          onDeleteTool={onDeleteTool}
        />
      </main>
    );
  }
  
  const ragBase = activeUnit?.ragBaseId ? ragBases.find(b => b.id === activeUnit.ragBaseId) : undefined;
  
  const isWideLayout = activeRoom.units.length > 5 || activeUnit;

  return (
    <main className="flex-1 flex bg-background overflow-hidden">
        <div className={`border-r border-border-color p-4 overflow-y-auto ${isWideLayout ? 'w-1/3' : 'w-1/2'}`}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-text-primary">{activeRoom.name}</h3>
                <AddUnitButton 
                    roomId={activeRoom.id}
                    onAdd={onAddUnit}
                />
            </div>
            {activeRoom.manager && <p className="text-text-secondary mb-6">Manager: <span className="font-semibold text-text-primary">{activeRoom.manager}</span></p>}

            <h4 className="text-sm font-semibold text-text-secondary mt-6 mb-3 px-1">Units</h4>
            <div className="space-y-3">
              {activeRoom.units.map(unit => (
                <UnitCard 
                  key={unit.id} 
                  unit={unit} 
                  onSelect={() => onSelectUnit(unit.id)} 
                  onDelete={() => onDeleteUnit(unit.id)}
                  isActive={activeUnit?.id === unit.id} 
                />
              ))}
            </div>
        </div>
        <div className={`p-4 overflow-y-auto ${isWideLayout ? 'w-2/3' : 'w-1/2'}`}>
            {activeUnit ? (
                <UnitDetailView 
                  key={activeUnit.id} 
                  unit={activeUnit} 
                  onUpdate={onUpdateUnit} 
                  roomId={activeRoom.id}
                  allTools={allTools}
                  ragBase={ragBase}
                  onUpdateRagBase={onUpdateRagBase}
                  activeRoomName={activeRoom.name}
                />
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-text-secondary">
                    <Icon name="brain" className="w-16 h-16 mb-4" />
                    <h2 className="text-xl font-semibold">Select a Unit</h2>
                    <p>Choose a unit from the list to view and edit its properties.</p>
                </div>
            )}
        </div>
    </main>
  );
};

export default MainContent;