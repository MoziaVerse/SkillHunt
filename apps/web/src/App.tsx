import { Navigate, RouterProvider, createBrowserRouter, useParams } from 'react-router';
import HowToInstall from './routes/docs/how-to-install';
import HowToPublish from './routes/docs/how-to-publish';
import DocsIndex from './routes/docs/index';
import DocsLayout from './routes/docs/layout';
import WhatIsASkill from './routes/docs/what-is-a-skill';
import Layout from './routes/layout';
import PublishPage from './routes/publish';
import SettingsProfilePage from './routes/settings-profile';
import SettingsTokensPage from './routes/settings-tokens';
import SkillDetail from './routes/skill-detail';
import SkillEditPage from './routes/skill-edit';
import SkillsList from './routes/skills-list';
import UserPage from './routes/user';

// Phase 2: legacy /skills/:slug → redirect to /skills/mozia/:slug.
// Older bookmarks and links keep working without users seeing 404.
function LegacySkillRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/skills/mozia/${slug ?? ''}`} replace />;
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <SkillsList /> },
      { path: 'skills/:owner/:slug', element: <SkillDetail /> },
      { path: 'skills/:owner/:slug/edit', element: <SkillEditPage /> },
      { path: 'skills/:slug', element: <LegacySkillRedirect /> },
      { path: 'publish', element: <PublishPage /> },
      { path: 'u/:owner', element: <UserPage /> },
      { path: 'settings/profile', element: <SettingsProfilePage /> },
      { path: 'settings/tokens', element: <SettingsTokensPage /> },
      {
        path: 'docs',
        element: <DocsLayout />,
        children: [
          { index: true, element: <DocsIndex /> },
          { path: 'what-is-a-skill', element: <WhatIsASkill /> },
          { path: 'how-to-install', element: <HowToInstall /> },
          { path: 'how-to-publish', element: <HowToPublish /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
