import { type NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Feed: undefined;
  Create: undefined;
  Ranks: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  PostDetail: { postId: string };
};
