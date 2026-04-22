import { RouterProvider, createBrowserRouter } from 'react-router';
import HowToInstall from './routes/docs/how-to-install';
import HowToPublish from './routes/docs/how-to-publish';
import DocsIndex from './routes/docs/index';
import DocsLayout from './routes/docs/layout';
import WhatIsASkill from './routes/docs/what-is-a-skill';
import Layout from './routes/layout';
import SkillDetail from './routes/skill-detail';
import SkillsList from './routes/skills-list';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <SkillsList /> },
      { path: 'skills/:slug', element: <SkillDetail /> },
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
