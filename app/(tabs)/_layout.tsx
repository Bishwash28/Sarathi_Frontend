import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';

// Individual Animated Tab Button with Top Red Active Line
interface TabButtonProps {
  route: any;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  label: string;
  role?: string;
}

const TabButton: React.FC<TabButtonProps> = ({ route, isFocused, onPress, onLongPress, label, role }) => {
  const lineAnim = useRef(new Animated.Value(isFocused ? 1.0 : 0.0)).current;

  useEffect(() => {
    Animated.timing(lineAnim, {
      toValue: isFocused ? 1.0 : 0.0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  const getIconName = (routeName: string, focused: boolean) => {
    switch (routeName) {
      case 'index':
        if (role === 'driver') {
          return focused ? 'add-circle' : 'add-circle-outline';
        }
        return focused ? 'home' : 'home-outline';
      case 'activity':
        return focused ? 'receipt' : 'receipt-outline';
      case 'inbox':
        return focused ? 'mail' : 'mail-outline';
      case 'profile':
        return focused ? 'person' : 'person-outline';
      default:
        return 'square-outline';
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      activeOpacity={0.7}
    >
      {/* Top Red Active Line */}
      <Animated.View style={[
        styles.topIndicatorLine,
        {
          opacity: lineAnim,
        }
      ]} />

      <Ionicons
        name={getIconName(route.name, isFocused) as any}
        size={22}
        color={isFocused ? Colors.accent : Colors.textMuted}
        style={styles.icon}
      />

      <Text style={[
        styles.tabLabel,
        {
          color: isFocused ? Colors.accent : Colors.textMuted,
          fontWeight: isFocused ? '600' : '400',
        }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// Custom Tab Bar Container
const CustomTabBar: React.FC<BottomTabBarProps & { role?: string }> = ({ state, descriptors, navigation, role }) => {
  return (
    <View style={styles.tabBarContainer}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? (options.tabBarLabel as string)
            : options.title !== undefined
              ? options.title
              : route.name;

        const isFocused = state.index === index;

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

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TabButton
            key={route.key}
            route={route}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
            label={label}
            role={role}
          />
        );
      })}
    </View>
  );
};

export default function TabLayout() {
  const { user } = useApp();
  const isDriver = user?.role === 'driver';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} role={user?.role} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: isDriver ? 'Post' : 'Home',
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
            title: 'Inbox',
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

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    height: 60,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    position: 'relative',
    paddingTop: 6,
    paddingBottom: 2,
  },
  topIndicatorLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: Colors.accent,
  },
  icon: {
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
  },
});
