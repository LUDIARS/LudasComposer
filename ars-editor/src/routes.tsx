import type { RouteObject } from 'react-router';
import { ReactFlowProvider } from '@xyflow/react';
import { AppLayout } from './AppLayout';
import { EditorPage } from './features/editor-page';
import { ProjectSettingsPage } from './features/project-settings';
import { OAuthCallback } from './components/OAuthCallback';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: (
          <ReactFlowProvider>
            <EditorPage />
          </ReactFlowProvider>
        ),
      },
      { path: 'settings', element: <ProjectSettingsPage /> },
    ],
  },
  { path: '/auth/callback', element: <OAuthCallback /> },
];
