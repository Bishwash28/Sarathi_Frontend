import { router } from 'expo-router';
import { useEffect } from 'react';
import { Animated, Dimensions, Image, StatusBar, StyleSheet, View, Platform } from 'react-native';
import { Colors } from '../constants/Colors';
import * as SystemUI from 'expo-system-ui';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    if (Platform.OS === 'android') {
      SystemUI.setBackgroundColorAsync(Colors.background);
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      router.replace('/onboarding');
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <Image
          source={require('../assets/images/splash_screen.png')}
          style={styles.logo}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background, // Deep Slate
  },
  logo: {
    width: "100%",
    height: "100%",
  },
});
