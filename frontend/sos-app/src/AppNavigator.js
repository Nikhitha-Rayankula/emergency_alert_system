import React from 'react';
import { ActivityIndicator, View, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import { C, RADIUS } from './ui';

// Auth Screens
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';

// Common Screens
import AlertsScreen from './screens/AlertsScreen';
import ProfileScreen from './screens/ProfileScreen';
import IncidentDetail from './screens/IncidentDetail';
import SocietyUsers from './screens/SocietyUsers';
import AllIncidentsScreen from './screens/AllIncidentsScreen';

// Role Screens
import ResidentHome from './screens/ResidentHome';
import MyIncidents from './screens/MyIncidents';
import ResidentContactsScreen from './screens/ResidentContactsScreen';

import GuardianDashboard from './screens/GuardianDashboard';
import FlatMembersScreen from './screens/FlatMembersScreen';

import VolunteerDashboard from './screens/VolunteerDashboard';
import VolunteerMapScreen from './screens/VolunteerMapScreen';

import SecurityDashboard from './screens/SecurityDashboard';

import SocietyAdminDashboard from './screens/SocietyAdminDashboard';
import SocietyStructureScreen from './screens/SocietyStructureScreen';
import EscalationConfigScreen from './screens/EscalationConfigScreen';

import PlatformAdminDashboard from './screens/PlatformAdminDashboard';
import SocietiesManagementScreen from './screens/SocietiesManagementScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab configurations per role
const TAB_CONFIGS = {
  Resident: [
    ['Home', ResidentHome, 'home', 'home-outline'],
    ['My SOS', MyIncidents, 'alert-circle', 'alert-circle-outline'],
    ['Contacts', ResidentContactsScreen, 'call', 'call-outline'],
    ['Alerts', AlertsScreen, 'notifications', 'notifications-outline'],
    ['Profile', ProfileScreen, 'person', 'person-outline'],
  ],
  Guardian: [
    ['Dashboard', GuardianDashboard, 'shield-checkmark', 'shield-checkmark-outline'],
    ['Flat Members', FlatMembersScreen, 'people', 'people-outline'],
    ['Alerts', AlertsScreen, 'notifications', 'notifications-outline'],
    ['Profile', ProfileScreen, 'person', 'person-outline'],
  ],
  Volunteer: [
    ['Dashboard', VolunteerDashboard, 'heart', 'heart-outline'],
    ['Radar Map', VolunteerMapScreen, 'map', 'map-outline'],
    ['Alerts', AlertsScreen, 'notifications', 'notifications-outline'],
    ['Profile', ProfileScreen, 'person', 'person-outline'],
  ],
  Security: [
    ['Command Hub', SecurityDashboard, 'shield', 'shield-outline'],
    ['Radar Map', VolunteerMapScreen, 'map', 'map-outline'],
    ['Alerts', AlertsScreen, 'notifications', 'notifications-outline'],
    ['Profile', ProfileScreen, 'person', 'person-outline'],
  ],
  'Sub Admin': [
    ['Society Hub', SocietyAdminDashboard, 'business', 'business-outline'],
    ['Members', SocietyUsers, 'people', 'people-outline'],
    ['Structure', SocietyStructureScreen, 'grid', 'grid-outline'],
    ['Escalation', EscalationConfigScreen, 'git-network', 'git-network-outline'],
    ['Profile', ProfileScreen, 'person', 'person-outline'],
  ],
  Admin: [
    ['Overview', PlatformAdminDashboard, 'speedometer', 'speedometer-outline'],
    ['Societies', SocietiesManagementScreen, 'business', 'business-outline'],
    ['All Users', SocietyUsers, 'people', 'people-outline'],
    ['Incidents', AllIncidentsScreen, 'warning', 'warning-outline'],
    ['Profile', ProfileScreen, 'person', 'person-outline'],
  ],
};

function RoleTabs() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const userRole = user?.group_name || 'Resident';
  const tabs = TAB_CONFIGS[userRole] || TAB_CONFIGS.Resident;

  // Safe bottom padding for Android navigation bar / gesture handle and iOS home bar
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);
  const tabHeight = 56 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: userRole === 'Resident' ? C.sos : C.ink,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: [
          styles.tabBar,
          {
            height: tabHeight,
            paddingBottom: bottomInset > 0 ? bottomInset : 6,
          },
        ],
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      {tabs.map(([name, Component, activeIcon, inactiveIcon]) => (
        <Tab.Screen
          key={name}
          name={name}
          component={Component}
          options={{
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={focused ? activeIcon : inactiveIcon}
                size={size || 22}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={C.sos} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: C.ink,
          headerTitleStyle: { fontWeight: '800', fontSize: 17 },
          headerShadowVisible: false,
        }}
      >
        {user ? (
          <>
            <Stack.Screen
              name="Main"
              component={RoleTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="IncidentDetail"
              component={IncidentDetail}
              options={{
                title: 'Emergency Navigation & Hub',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="Alerts"
              component={AlertsScreen}
              options={{ title: 'Emergency Alerts' }}
            />
            <Stack.Screen
              name="People"
              component={SocietyUsers}
              options={{ title: 'Member Directory' }}
            />
            <Stack.Screen
              name="Members"
              component={SocietyUsers}
              options={{ title: 'Member Directory' }}
            />
            <Stack.Screen
              name="Users"
              component={SocietyUsers}
              options={{ title: 'Platform Directory' }}
            />
            <Stack.Screen
              name="Contacts"
              component={ResidentContactsScreen}
              options={{ title: 'Safety Contacts' }}
            />
            <Stack.Screen
              name="FlatMembers"
              component={FlatMembersScreen}
              options={{ title: 'Flat Members' }}
            />
            <Stack.Screen
              name="Structure"
              component={SocietyStructureScreen}
              options={{ title: 'Towers & Flats' }}
            />
            <Stack.Screen
              name="Escalation"
              component={EscalationConfigScreen}
              options={{ title: 'Escalation Rules' }}
            />
            <Stack.Screen
              name="Societies"
              component={SocietiesManagementScreen}
              options={{ title: 'Gated Societies' }}
            />
            <Stack.Screen
              name="Incidents"
              component={AllIncidentsScreen}
              options={{ title: 'Incident Feed' }}
            />
            <Stack.Screen
              name="NearbyMap"
              component={VolunteerMapScreen}
              options={{ title: 'Live Radar Map' }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: 'My Account' }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ title: 'Reset Password' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{
                title: 'Create Account',
                headerBackTitle: 'Sign In',
              }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{
                title: 'Reset Password',
                headerBackTitle: 'Sign In',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: C.line,
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabBarLabel: {
    fontWeight: '700',
    fontSize: 11,
  },
});