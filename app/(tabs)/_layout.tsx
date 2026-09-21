import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs, router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';

interface CustomTabProps extends BottomTabBarProps {
  isDriver: boolean;
  kycVerified: boolean;
}

export default function TabLayout() {
  const { user } = useApp();
  const isDriverMode = user?.role === 'driver' && user?.kycVerified === true;
  const kycVerified = user?.kycVerified === true;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'left', 'right']}>
      <Tabs
        tabBar={(props: any) => <FloatingTabBar {...props} isDriver={isDriverMode} kycVerified={kycVerified} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: isDriverMode ? 'Post' : 'Home',
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alerts',
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: 'Activity',
          }}
        />
        <Tabs.Screen
          name="inbox"
          options={{
            title: isDriverMode ? 'Chats' : 'Inbox',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

const FloatingTabBar: React.FC<CustomTabProps> = ({ state, descriptors, navigation, isDriver, kycVerified }) => {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 10) + 8;

  const homeRouteIndex = state.routes.findIndex(r => r.name === 'index');
  const notifRouteIndex = state.routes.findIndex(r => r.name === 'notifications');
  const activityRouteIndex = state.routes.findIndex(r => r.name === 'activity');
  const inboxRouteIndex = state.routes.findIndex(r => r.name === 'inbox');
  const profileRouteIndex = state.routes.findIndex(r => r.name === 'profile');

  const getRouteConfig = (routeName: string) => {
    switch (routeName) {
      case 'index':
        return { label: isDriver ? 'Post' : 'Home', icon: isDriver ? 'add-circle' : 'home' };
      case 'notifications':
        return { label: 'Alerts', icon: 'notifications' };
      case 'activity':
        return { label: 'Activity', icon: 'time' };
      case 'inbox':
        return { label: isDriver ? 'Chats' : 'Inbox', icon: 'chatbubbles' };
      case 'profile':
        return { label: 'Profile', icon: 'person' };
      default:
        return { label: 'Tab', icon: 'grid' };
    }
  };

  const renderTabItem = (index: number) => {
    if (index < 0 || index >= state.routes.length) return null;
    const route = state.routes[index];
    const isFocused = state.index === index;
    const { label, icon } = getRouteConfig(route.name);

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    return (
      <TouchableOpacity
        key={route.key}
        onPress={onPress}
        style={styles.tabItem}
        activeOpacity={0.75}
      >
        <Ionicons
          name={(isFocused ? icon : `${icon}-outline`) as any}
          size={22}
          color={isFocused ? Colors.primary : '#94A3B8'}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: isFocused ? Colors.primary : '#94A3B8', fontWeight: isFocused ? '700' : '500' },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const handleCenterPostPress = () => {
    if (homeRouteIndex >= 0) {
      navigation.navigate(state.routes[homeRouteIndex].name);
    }
  };

  // Passenger UI: 5 Tabs (Home, Alerts, Activity, Inbox, Profile)
  if (!isDriver) {
    return (
      <View style={[styles.floatingContainer, { bottom: bottomOffset }]}>
        <View style={styles.floatingBar}>
          {renderTabItem(homeRouteIndex)}
          {renderTabItem(notifRouteIndex)}
          {renderTabItem(activityRouteIndex)}
          {renderTabItem(inboxRouteIndex)}
          {renderTabItem(profileRouteIndex)}
        </View>
      </View>
    );
  }

  // Rider UI: Activity | Alerts | Center Big Red (+) POST Button | Chats | Profile
  return (
    <View style={[styles.floatingContainer, { bottom: bottomOffset }]}>
      <View style={styles.floatingBar}>
        {/* Left Tab 1: Activity */}
        {renderTabItem(activityRouteIndex)}

        {/* Left Tab 2: Alerts (Notifications) */}
        {renderTabItem(notifRouteIndex)}

        {/* Center Prominent Floating (+) POST Button for Rider */}
        <TouchableOpacity
          style={styles.centerPostButtonDriver}
          onPress={handleCenterPostPress}
          activeOpacity={0.88}
        >
          <Ionicons
            name="add"
            size={28}
            color="#FFFFFF"
          />
          <Text style={styles.centerPostText}>Post</Text>
        </TouchableOpacity>

        {/* Right Tab 1: Chats */}
        {renderTabItem(inboxRouteIndex)}

        {/* Right Tab 2: Profile */}
        {renderTabItem(profileRouteIndex)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 16,
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    height: 64,
    paddingHorizontal: 12,
    elevation: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    width: '100%',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  centerPostButtonDriver: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    top: -14,
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  centerPostText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    marginTop: -2,
  },
});
