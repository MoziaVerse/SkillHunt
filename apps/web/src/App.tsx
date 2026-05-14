import { Navigate, RouterProvider, createBrowserRouter, useParams } from 'react-router';
import ApiReference from './routes/docs/api-reference';
import FileStructure from './routes/docs/file-structure';
import DocsIndex from './routes/docs/index';
import DocsLayout from './routes/docs/layout';
import PublishInfo from './routes/docs/publish-info';
import QualityChecklist from './routes/docs/quality-checklist';
import QuickStart from './routes/docs/quick-start';
import WhatIsASkill from './routes/docs/what-is-a-skill';
import WriteSkillMd from './routes/docs/write-skill-md';
import Layout from './routes/layout';
import NotificationsPage from './routes/notifications';
import PackageCreate from './routes/package-create';
import PackageDetail from './routes/package-detail';
import PublishPage from './routes/publish';
import PublishChoicePage from './routes/publish-choice';
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
      { path: 'packages', element: <Navigate to="/?content=packages" replace /> },
      { path: 'packages/new', element: <Navigate to="/publish/package" replace /> },
      { path: 'packages/:owner/:slug', element: <PackageDetail /> },
      { path: 'publish', element: <PublishChoicePage /> },
      { path: 'publish/skill', element: <PublishPage /> },
      { path: 'publish/package', element: <PackageCreate /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'u/:owner', element: <UserPage /> },
      {
        path: 'docs',
        element: <DocsLayout />,
        children: [
          { index: true, element: <DocsIndex /> },
          { path: 'what-is-a-skill', element: <WhatIsASkill /> },
          { path: 'quick-start', element: <QuickStart /> },
          { path: 'write-skill-md', element: <WriteSkillMd /> },
          { path: 'file-structure', element: <FileStructure /> },
          { path: 'publish-info', element: <PublishInfo /> },
          { path: 'quality-checklist', element: <QualityChecklist /> },
          { path: 'api-reference', element: <ApiReference /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
