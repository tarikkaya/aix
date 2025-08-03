import React from 'react';

type IconName = 'plus' | 'trash' | 'settings' | 'chevron-up' | 'chevron-down' | 'brain' | 'database' | 'arrow-up' | 'arrow-down' | 'upload' | 'palette' | 'x-mark' | 'message' | 'copy' | 'folder' | 'chart-bar' | 'link' | 'youtube' | 'notion' | 'github' | 'recycle' | 'photo' | 'paper-clip' | 'document-text' | 'adjustments-horizontal' | 'microphone' | 'speaker-wave' | 'clock' | 'spinner' | 'wrench-screwdriver' | 'check-mark' | 'send';

interface IconProps {
  name: IconName;
  className?: string;
}

const ICONS: Record<IconName, React.ReactNode> = {
  plus: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />,
  trash: <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />,
  settings: <><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-1.006 1.11-1.226l.46-.153a1.875 1.875 0 0 1 1.745 0l.46.153c.55.22 1.02.684 1.11 1.226l.09.542a1.875 1.875 0 0 1-1.054 2.285l-.542.27c-1.14.57-1.14 2.24 0 2.81l.542.27a1.875 1.875 0 0 1 1.054 2.285l-.09.542c-.09.542-.56 1.006-1.11 1.226l-.46.153a1.875 1.875 0 0 1-1.745 0l-.46-.153c-.55-.22-1.02-.684-1.11-1.226l-.09-.542a1.875 1.875 0 0 1 1.054-2.285l.542-.27c1.14-.57 1.14-2.24 0-2.81l-.542-.27a1.875 1.875 0 0 1-1.054-2.285l.09-.542Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.375v11.25" /></>,
  'adjustments-horizontal': <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 0H3.75m16.5 6H3.75m16.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 0H3.75m16.5 6h-9.75M10.5 18a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 0h-2.25" />,
  'chevron-up': <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />,
  'chevron-down': <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />,
  brain: <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />,
  database: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18a3 3 0 0 0-3-3V6.108c0-1.135.845-2.098 1.976-2.192a48.424 48.424 0 0 1 1.123-.08M15.75 18V9.75M8.25 9.75v8.25" />,
  'arrow-up': <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />,
  'arrow-down': <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />,
  upload: <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />,
  palette: <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75L9 7.5h6L12 3.75z M9 16.5h6v-1.5H9v1.5z M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  'x-mark': <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />,
  message: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />,
  copy: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375v-4.5" />,
  folder: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75v6s0 1.5 1.5 1.5h16.5s1.5 0 1.5-1.5v-6m-19.5 0v-2.625c0-.621.504-1.125 1.125-1.125h17.25c.621 0 1.125.504 1.125 1.125V12.75m-19.5 0a9 9 0 0 0 19.5 0m-19.5 0a9 9 0 0 1 19.5 0" />,
  'chart-bar': <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />,
  link: <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />,
  youtube: <path d="M10,15L15.5,12L10,9V15M21.5,12C21.5,16.75 19.8,20.5 16,21.5C12,22.5 7.5,22.5 4.5,21.5C0.2,20.5 -1.5,16.75 -1.5,12C-1.5,7.25 0.2,3.5 4,2.5C8,1.5 12.5,1.5 15.5,2.5C19.8,3.5 21.5,7.25 21.5,12Z" />,
  notion: <path d="M7,2h10v1.5h-5v17h-1.5V3.5H7V2z M8.5,3.5h5v2.5h-5V3.5z M8.5,7.5h5v2.5h-5V7.5z M8.5,11.5h5v2.5h-5V11.5z M13,22 L8.5,15h5L18,22h-5z" />,
  github: <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1.9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.7-1.4-2.3-.3-4.7-1.1-4.7-5.1 0-1.1.4-2 1.1-2.7-.1-.3-.5-1.3.1-2.7 0 0 .9-.3 2.8 1.1.8-.2 1.7-.3 2.5-.3s1.7.1 2.5.3c1.9-1.3 2.8-1.1 2.8-1.1.6 1.4.2 2.4.1 2.7.7.7 1.1 1.6 1.1 2.7 0 4-2.4 4.8-4.7 5.1.4.3.8.9.8 1.8v2.6c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />,
  recycle: <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.667 0l3.181-3.183m-4.991-2.691h4.992v.001M2.985 4.356v4.992m0 0h4.992m-4.993 0-3.181-3.183a8.25 8.25 0 0 1 11.667 0l3.181 3.183" />,
  photo: <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />,
  'paper-clip': <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.738-9.662 9.662a4.5 4.5 0 0 1-6.364-6.364l1.5-1.5m14.375-14.375-1.5 1.5a4.5 4.5 0 0 1-6.364 6.364l-9.662-9.662" />,
  'document-text': <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />,
  microphone: <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m12-9A6 6 0 0 0 6 8.25v1.5m6-7.5a6 6 0 0 1 6 6v1.5m-6-3.75A3.375 3.375 0 0 1 15.375 9.75v1.5" />,
  'speaker-wave': <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.042a8.967 8.967 0 0 0 6.364-6.364m-6.364 6.364l-6.364-6.364m6.364 6.364V14.25m8.965-4.233a8.965 8.965 0 0 1-6.364 6.364m6.364-6.364-.005.005m0 0l-6.364-6.364M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0Z" />,
  clock: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  spinner: <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.667 0l3.181-3.183m-4.991-2.691h4.992v.001M2.985 4.356v4.992m0 0h4.992m-4.993 0-3.181-3.183a8.25 8.25 0 0 1 11.667 0l3.181 3.183" />,
  'wrench-screwdriver': <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />,
  'check-mark': <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  send: <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L6 12Zm0 0h7.5" />,
};

const Icon: React.FC<IconProps> = ({ name, className }) => (
  <svg
    className={className}
    fill="none"
    strokeWidth="1.5"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    {ICONS[name]}
  </svg>
);

export default Icon;