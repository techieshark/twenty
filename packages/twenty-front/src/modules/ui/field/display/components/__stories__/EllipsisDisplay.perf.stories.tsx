import { Meta } from '@storybook/react';
import { ComponentDecorator } from 'twenty-ui';

import { EllipsisDisplay } from '@/ui/field/display/components/EllipsisDisplay';
import { getProfilingStory } from '~/testing/profiling/utils/getProfilingStory';

const meta: Meta = {
  title: 'UI/Input/EllipsisDisplay/EllipsisDisplay',
  component: EllipsisDisplay,
  decorators: [ComponentDecorator],
  args: {
    maxWidth: 100,
    children: 'This is a long text that should be truncated',
  },
  tags: ['performance'],
};

export default meta;

export const Performance = getProfilingStory('EllipsisDisplay', 0.1, 2, 2);