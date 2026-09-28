import React from 'react';
import { Text, TextStyle } from 'react-native';

/**
 * Renders text containing Markdown bold syntax (**bold**)
 * as React Native Text elements without showing raw asterisks (**).
 */
export function renderFormattedText(
  text: string,
  baseStyle: TextStyle | TextStyle[],
  boldStyle: TextStyle = { fontWeight: 'bold' }
) {
  if (!text) return null;
  if (!text.includes('**')) {
    return <Text style={baseStyle}>{text}</Text>;
  }

  const parts = text.split('**');
  return (
    <Text style={baseStyle}>
      {parts.map((part, index) => {
        if (!part) return null;
        if (index % 2 === 1) {
          return (
            <Text key={index} style={[baseStyle, boldStyle]}>
              {part}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
}
