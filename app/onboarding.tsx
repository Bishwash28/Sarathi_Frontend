import { router } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, ImageBackground, NativeScrollEvent, NativeSyntheticEvent, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Every Journey Begins With Someone',
    description: "No road is too long when you're not traveling it alone. Welcome to Sarathi — where every ride tells a story of connection.",
    bgImage: require('../assets/images/onboard_img01.png'),
    isDarkBg: false,
    bgColor: Colors.background,
  },
  {
    id: '2',
    title: 'Your Path, Shared',
    description: "Somewhere on your route, someone's heading the same way. Sarathi finds them — turning a daily commute into company along the way.",
    bgImage: require('../assets/images/onboard_img02.png'),
    isDarkBg: false,
    bgColor: Colors.background,
  },
  {
    id: '3',
    title: 'Strangers Today, Familiar Faces Tomorrow',
    description: "Verified riders. Real trust. Because the best journeys are the ones where you feel safe enough to simply enjoy the ride.",
    bgImage: require('../assets/images/onboard_img03.png'),
    isDarkBg: false,
    bgColor: Colors.background,
  }
];

export default function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = slides[currentSlide];
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      SystemUI.setBackgroundColorAsync(slide.bgColor);
    }
  }, [currentSlide, slide.bgColor]);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      const nextIndex = currentSlide + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentSlide(nextIndex);
    } else {
      router.replace('/(auth)/login');
    }
  };

  const handleSkip = () => {
    router.replace('/(auth)/login');
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (slideIndex >= 0 && slideIndex < slides.length && slideIndex !== currentSlide) {
      setCurrentSlide(slideIndex);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: slide.bgColor }]}>
      <StatusBar barStyle={slide.isDarkBg ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Fullscreen Horizontal Swipe List */}
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ width, flex: 1 }}>
            <ImageBackground
              source={item.bgImage}
              style={styles.backgroundImage}
              resizeMode="cover"
            >
              <View style={styles.content}>
                <Text style={styles.title}>
                  {item.title}
                </Text>
                <Text style={styles.description}>
                  {item.description}
                </Text>
              </View>
            </ImageBackground>
          </View>
        )}
      />

      {/* Floating Header Overlay: Fixed Skip Button */}
      <SafeAreaView style={styles.floatingHeaderContainer} pointerEvents="box-none" edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          {currentSlide < slides.length - 1 ? (
            <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
        </View>
      </SafeAreaView>

      {/* Floating Footer Overlay for smooth dots & button control */}
      <View style={styles.floatingFooterContainer} pointerEvents="box-none">
        <SafeAreaView edges={['bottom', 'left', 'right']}>
          <View style={styles.footer}>
            <View style={styles.dotsContainer}>
              {slides.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    flatListRef.current?.scrollToIndex({ index, animated: true });
                    setCurrentSlide(index);
                  }}
                  style={[
                    styles.dot,
                    currentSlide === index
                      ? styles.activeDot
                      : styles.inactiveDot
                  ]}
                />
              ))}
            </View>

            <TouchableOpacity style={styles.button} onPress={handleNext}>
              <Text style={styles.buttonText}>
                {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  floatingHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    paddingHorizontal: 20,
    alignItems: 'flex-end',
    height: 50,
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 16,
    color: Colors.secondary || '#C62026',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 110,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.secondary || '#C62026',
    textAlign: 'center',
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    color: Colors.secondary || '#C62026',
    textAlign: 'center',
    lineHeight: 24,
  },
  floatingFooterContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingBottom: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  activeDot: {
    width: 24,
    backgroundColor: Colors.accent,
  },
  inactiveDot: {
    width: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  button: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
