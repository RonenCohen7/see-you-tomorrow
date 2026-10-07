import { router, usePathname } from "expo-router";
import { useRef, type ReactNode } from "react";
import { Animated, PanResponder, StyleSheet, useWindowDimensions, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";

export default function SignedInSwipe({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const path = usePathname();
  const { width } = useWindowDimensions();
  const statusRef = useRef(status);
  const pathRef = useRef(path);
  const widthRef = useRef(width);
  statusRef.current = status;
  pathRef.current = path;
  widthRef.current = width;
  const shift = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (statusRef.current !== "signedIn") return false;
        if (pathRef.current === "/login") return false;
        return Math.abs(gesture.dx) > 48 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2;
      },
      onPanResponderMove: (_, gesture) => {
        if (statusRef.current !== "signedIn") return;
        shift.setValue(Math.max(-140, Math.min(140, gesture.dx)));
      },
      onPanResponderRelease: (_, gesture) => {
        const here = pathRef.current;
        const toMenu = gesture.dx < -60 && here !== "/home";
        const toEntry = gesture.dx > 60 && here !== "/" && here !== "/index";
        const target = toMenu ? "/home" : toEntry ? "/" : null;
        Animated.timing(shift, {
          toValue: target === "/home" ? -widthRef.current : target === "/" ? widthRef.current : 0,
          duration: target ? 180 : 140,
          useNativeDriver: true,
        }).start(() => {
          shift.setValue(0);
          if (target) router.replace(target);
        });
      },
      onPanResponderTerminate: () => {
        Animated.spring(shift, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const panHandlers = status === "signedIn" ? pan.panHandlers : undefined;

  return (
    <Animated.View style={[styles.fill, { transform: [{ translateX: shift }] }]} {...panHandlers}>
      <View style={styles.fill}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
