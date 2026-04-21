import type { RouteObject } from 'react-router';
import { ReactFlowProvider } from '@xyflow/react';
import { AppLayout } from './AppLayout';
import { EditorPage } from './features/editor-page';
import { ProjectSettingsPage } from './features/project-settings';
import { AssetBrowser } from './features/asset-browser';
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
      { path: 'assets', element: <AssetBrowser /> },
    ],
  },
  { path: '/auth/callback', element: <OAuthCallback /> },
];
