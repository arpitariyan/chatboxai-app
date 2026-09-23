/**
 * src/components/chat/AttachmentImage.tsx
 *
 * Production Attachment Image Component using Expo Image.
 * Matches Master Specification Section 22 & 44.
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { IconPhotoOff } from '@tabler/icons-react-native';
import { useThemeColors } from '@/theme';
import { auth } from '@/config/firebase';

interface AttachmentImageProps {
  /** Ordered URLs to try, from resolveAttachment(). */
  candidates: string[];
  style: StyleProp<ImageStyle>;
}

export const AttachmentImage: React.FC<AttachmentImageProps> = ({ candidates, style }) => {
  const colors = useThemeColors();
  const [index, setIndex] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const refreshedTokenRef = useRef(false);

  // Retrieve Firebase ID token for authenticated media requests
  useEffect(() => {
    let mounted = true;
    const fetchToken = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const t = await currentUser.getIdToken();
          if (mounted) setToken(t);
        }
      } catch {
        if (mounted) setToken(null);
      }
    };

    fetchToken();
    return () => {
      mounted = false;
    };
  }, []);

  // Reset index when candidates change
  const signature = candidates.map((c) => `${c.length}:${c.slice(0, 80)}`).join('|');
  useEffect(() => {
    setIndex(0);
    refreshedTokenRef.current = false;
  }, [signature]);

  const src = candidates[index];

  if (!src) {
    return (
      <View
        style={[
          style as any,
          {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.inset,
            borderRadius: 10,
          },
        ]}
      >
        <IconPhotoOff size={22} color={colors.ink3} strokeWidth={1.5} />
      </View>
    );
  }

  const isRemote = /^https?:\/\//i.test(src);

  // If remote URL requires auth and token is currently being resolved, show subtle loader
  if (isRemote && src.includes('/api/mobile/file') && !token && auth.currentUser) {
    return (
      <View
        style={[
          style as any,
          {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.inset,
            borderRadius: 10,
          },
        ]}
      >
        <ActivityIndicator size="small" color={colors.ink3} />
      </View>
    );
  }

  return (
    <View style={[style as any, { overflow: 'hidden' }]}>
      <ExpoImage
        source={
          isRemote
            ? {
                uri: src,
                headers: token
                  ? {
                      Authorization: `Bearer ${token}`,
                    }
                  : undefined,
              }
            : { uri: src }
        }
        style={style}
        contentFit="cover"
        transition={150}
        onLoadStart={() => setIsLoading(true)}
        onLoad={() => setIsLoading(false)}
        onError={async (e) => {
          setIsLoading(false);

          // If our authenticated mobile API endpoint failed and we haven't refreshed token yet, try a 1-time token refresh
          if (isRemote && src.includes('/api/mobile/file') && !refreshedTokenRef.current && auth.currentUser) {
            refreshedTokenRef.current = true;
            try {
              const fresh = await auth.currentUser.getIdToken(true);
              setToken(fresh);
              return;
            } catch {
              // Token refresh failed, continue to fallback
            }
          }

          // Advance to next candidate if available, or advance to fallback IconPhotoOff
          setIndex((prev) => prev + 1);
        }}
      />
      {isLoading && (
        <View
          style={[
            style as any,
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.15)',
            },
          ]}
        >
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      )}
    </View>
  );
};
