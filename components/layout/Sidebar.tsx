import React from 'react';
import type { Room } from '../../types';
import Icon from '../ui/Icon';

interface SidebarProps {
  rooms: Room[];
  activeRoom: Room;
  onSelectRoom: (roomId: string) => void;
}

const ICONS_MAP: { [key: string]: React.ReactNode } = {
    'Admin Room': <Icon name="settings" className="w-4 h-4" />,
    'Communication Room': <Icon name="message" className="w-4 h-4" />,
    'Thought Room': <Icon name="brain" className="w-4 h-4" />,
    'Information Room': <Icon name="folder" className="w-4 h-4" />,
    'Information Search Room': <Icon name="database" className="w-4 h-4" />,
    'Visual Room': <Icon name="palette" className="w-4 h-4" />,
    'Sound Room': <Icon name="speaker-wave" className="w-4 h-4" />,
    'Sanctions Room': <Icon name="arrow-down" className="w-4 h-4" />,
    'Tools Room': <Icon name="wrench-screwdriver" className="w-4 h-4" />,
    'Proactive Room': <Icon name="clock" className="w-4 h-4" />,
};


const Sidebar: React.FC<SidebarProps> = ({ rooms, activeRoom, onSelectRoom }) => {
  return (
    <aside className="w-64 bg-surface flex-shrink-0 p-4 border-r border-border-color overflow-y-auto">
      <h2 className="text-sm font-semibold text-text-secondary mb-3 px-2">COALITION ROOMS</h2>
      <nav>
        <ul>
          {rooms.map((room) => (
            <li key={room.id}>
              <button
                onClick={() => onSelectRoom(room.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 my-1 text-left text-sm rounded-lg transition-colors ${
                  activeRoom.id === room.id
                    ? 'bg-primary/20 text-primary font-semibold'
                    : 'text-text-secondary hover:bg-surface-light hover:text-text-primary'
                }`}
              >
                <span className={activeRoom.id === room.id ? 'text-primary' : ''}>
                  {ICONS_MAP[room.name] || <Icon name="folder" className="w-4 h-4" />}
                </span>
                <span>{room.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
