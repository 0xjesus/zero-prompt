import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
  Image,
  useWindowDimensions
} from "react-native";
import {
  Wallet,
  Shield,
  CheckCircle,
  X,
  Sparkles,
  ArrowRight,
  Lock,
  User,
  MessageSquare,
  ExternalLink,
  Copy,
  LogOut,
  CreditCard
} from "lucide-react-native";

const ZEROPROMPT_LOGO = require('../assets/logos/zero-prompt-logo.png');

const FONT_MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// Animated gradient-like background using multiple animated views
const AnimatedBackground = ({ theme }: { theme: any }) => {
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse1, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse1, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse2, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse2, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      ),
      Animated.loop(
        Animated.timing(rotate, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true })
      )
    ];
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: 150,
            backgroundColor: theme.primary + '15',
            top: -100,
            right: -100,
            transform: [{ rotate: rotateInterpolate }, { scale: pulse1.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }]
          }
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: theme.accent + '10',
            bottom: -50,
            left: -50,
            transform: [{ scale: pulse2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }]
          }
        ]}
      />
    </View>
  );
};

// Animated wallet icon with glow effect
const AnimatedWalletIcon = ({ size = 64, theme, isActive }: { size?: number; theme: any; isActive: boolean }) => {
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: false })
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.05, duration: 800, useNativeDriver: false }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 800, useNativeDriver: false })
        ])
      ).start();
    }
  }, [isActive]);

  return (
    <Animated.View
      style={{
        width: size + 20,
        height: size + 20,
        borderRadius: (size + 20) / 2,
        backgroundColor: glowAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [theme.primary + '20', theme.primary + '40']
        }),
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ scale: scaleAnim }]
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.surface,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: theme.primary + '60'
        }}
      >
        <Wallet size={size * 0.5} color={theme.primary} />
      </View>
    </Animated.View>
  );
};

// Step indicator component
const StepIndicator = ({ step, theme }: { step: number; theme: any }) => {
  const steps = ['Connect', 'Sign', 'Verify'];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 20 }}>
      {steps.map((label, idx) => (
        <React.Fragment key={idx}>
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: idx < step ? theme.success : idx === step ? theme.primary : theme.surface,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: idx === step ? 2 : 1,
                borderColor: idx <= step ? theme.primary : theme.border
              }}
            >
              {idx < step ? (
                <CheckCircle size={16} color="#fff" />
              ) : (
                <Text style={{ color: idx === step ? '#fff' : theme.textSecondary, fontSize: 12, fontWeight: '700' }}>
                  {idx + 1}
                </Text>
              )}
            </View>
            <Text style={{ color: idx <= step ? theme.text : theme.textSecondary, fontSize: 10, marginTop: 4, fontFamily: FONT_MONO }}>
              {label}
            </Text>
          </View>
          {idx < steps.length - 1 && (
            <View
              style={{
                width: 40,
                height: 2,
                backgroundColor: idx < step ? theme.primary : theme.border,
                marginHorizontal: 8,
                marginBottom: 20
              }}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

// Main Connect Wallet Modal
interface WalletConnectModalProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
  isConnecting: boolean;
  isAuthenticating: boolean;
  connectionError: string | null;
  migratedChats: number | null;
  onClearMigratedChats: () => void;
}

export const WalletConnectModal = ({
  visible,
  onClose,
  theme,
  isConnecting,
  isAuthenticating,
  connectionError,
  migratedChats,
  onClearMigratedChats
}: WalletConnectModalProps) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true })
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  // Determine current step
  const currentStep = isAuthenticating ? 2 : isConnecting ? 1 : 0;
  const showSuccess = migratedChats !== null && migratedChats > 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim
            }
          ]}
        >
          <AnimatedBackground theme={theme} />

          {/* Close button */}
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.background }]} onPress={onClose}>
            <X size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          {/* Success State - Migration notification */}
          {showSuccess ? (
            <View style={styles.contentCenter}>
              <View style={[styles.successIcon, { backgroundColor: theme.success + '20' }]}>
                <Sparkles size={48} color={theme.success} />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>SYNC_COMPLETE</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Your anonymous chats have been linked to your wallet
              </Text>

              <View style={[styles.migrationBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <MessageSquare size={20} color={theme.primary} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[styles.migrationCount, { color: theme.primary }]}>{migratedChats} Conversations</Text>
                  <Text style={[styles.migrationLabel, { color: theme.textSecondary }]}>Successfully migrated</Text>
                </View>
                <CheckCircle size={20} color={theme.success} />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#8B5CF6' }]}
                onPress={() => {
                  onClearMigratedChats();
                  onClose();
                }}
              >
                <Text style={styles.primaryBtnText}>Continue to ZeroPrompt</Text>
                <ArrowRight size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : connectionError ? (
            // Error State
            <View style={styles.contentCenter}>
              <View style={[styles.errorIcon, { backgroundColor: '#ff4444' + '20' }]}>
                <X size={48} color="#ff4444" />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>CONNECTION_FAILED</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{connectionError}</Text>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#8B5CF6' }]}
                onPress={onClose}
              >
                <Text style={styles.primaryBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (isConnecting || isAuthenticating) ? (
            // Connecting/Authenticating State
            <View style={styles.contentCenter}>
              <AnimatedWalletIcon size={80} theme={theme} isActive={true} />
              <StepIndicator step={currentStep} theme={theme} />

              <Text style={[styles.title, { color: theme.text }]}>
                {isAuthenticating ? 'SIGN_MESSAGE' : 'CONNECTING'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {isAuthenticating
                  ? 'Please sign the message in your wallet to verify ownership'
                  : 'Opening wallet connection...'}
              </Text>

              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.primary }]}>
                  {isAuthenticating ? 'Waiting for signature...' : 'Connecting...'}
                </Text>
              </View>

              {isAuthenticating && (
                <View style={[styles.securityNote, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Shield size={16} color={theme.success} />
                  <Text style={[styles.securityText, { color: theme.textSecondary }]}>
                    This signature is free and does not send any transaction
                  </Text>
                </View>
              )}
            </View>
          ) : (
            // Initial State (shouldn't normally show since modal opens during connection)
            <View style={styles.contentCenter}>
              <AnimatedWalletIcon size={80} theme={theme} isActive={false} />
              <Text style={[styles.title, { color: theme.text }]}>CONNECT_WALLET</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Connect your wallet to sync your chats and add credits
              </Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

// Wallet Status Section for Sidebar
interface WalletSidebarSectionProps {
  user: any;
  theme: any;
  isConnecting: boolean;
  isAuthenticating: boolean;
  onConnectWallet: () => void;
  onLogout: () => void;
  currentBalance: number;
  onAddCredits: () => void;
}

export const WalletSidebarSection = ({
  user,
  theme,
  isConnecting,
  isAuthenticating,
  onConnectWallet,
  onLogout,
  currentBalance,
  onAddCredits
}: WalletSidebarSectionProps) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 600;
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: false
    }).start();
  }, [expanded]);

  // Pulse animation for connect button
  useEffect(() => {
    if (!user) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true })
        ])
      ).start();
    }
  }, [user]);

  const isLoading = isConnecting || isAuthenticating;

  if (!user?.walletAddress) {
    // Not connected state - Premium CTA (compact on mobile)
    return (
      <View style={[styles.sidebarCard, { backgroundColor: theme.background, borderColor: theme.border, padding: isMobile ? 10 : 16, marginTop: 0 }]}>
        {/* Animated glow background for CTA */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.primary,
              opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.03, 0.08] }),
              borderRadius: 16
            }
          ]}
        />

        <View style={[styles.guestHeader, { gap: isMobile ? 10 : 12 }]}>
          <View style={[styles.guestAvatar, { backgroundColor: theme.surface, width: isMobile ? 32 : 40, height: isMobile ? 32 : 40, borderRadius: isMobile ? 16 : 20 }]}>
            <User size={isMobile ? 16 : 20} color={theme.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.guestTitle, { color: theme.textSecondary, fontSize: isMobile ? 10 : 12 }]}>GUEST_MODE</Text>
            {!isMobile && <Text style={[styles.guestSub, { color: theme.textMuted }]}>Anonymous Session</Text>}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: isMobile ? 10 : 16 }]} />

        <TouchableOpacity
          style={[styles.connectBtn, { backgroundColor: '#8B5CF6', paddingVertical: isMobile ? 10 : 14 }]}
          onPress={onConnectWallet}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Wallet size={isMobile ? 16 : 18} color="#fff" />
              <Text style={[styles.connectBtnText, { fontSize: isMobile ? 12 : 14 }]}>Connect Wallet</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Hide benefits on mobile to save space */}
        {!isMobile && (
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <CheckCircle size={12} color={theme.success} />
              <Text style={[styles.benefitText, { color: theme.textSecondary }]}>Sync chats across devices</Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={12} color={theme.success} />
              <Text style={[styles.benefitText, { color: theme.textSecondary }]}>Add credits for premium AI</Text>
            </View>
            <View style={styles.benefitItem}>
              <CheckCircle size={12} color={theme.success} />
              <Text style={[styles.benefitText, { color: theme.textSecondary }]}>Keep your history forever</Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  // Connected state (compact on mobile)
  return (
    <View style={[styles.sidebarCard, { backgroundColor: theme.background, borderColor: theme.border, padding: isMobile ? 10 : 16, marginTop: 0 }]}>
      <TouchableOpacity style={[styles.walletHeader, { gap: isMobile ? 10 : 12 }]} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={[styles.walletAvatar, { backgroundColor: theme.primary + '20', width: isMobile ? 32 : 40, height: isMobile ? 32 : 40, borderRadius: isMobile ? 16 : 20 }]}>
          <Wallet size={isMobile ? 14 : 18} color={theme.primary} />
          <View style={[styles.onlineDot, { backgroundColor: theme.success, width: isMobile ? 8 : 10, height: isMobile ? 8 : 10, borderRadius: isMobile ? 4 : 5 }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.walletLabel, { color: theme.text, fontSize: isMobile ? 10 : 12 }]}>OPERATOR</Text>
          <Text style={[styles.walletAddress, { color: theme.textSecondary, fontSize: isMobile ? 9 : 10 }]}>
            {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
          </Text>
        </View>
        <Animated.View
          style={{
            transform: [{
              rotate: expandAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
            }]
          }}
        >
          <ArrowRight size={isMobile ? 14 : 16} color={theme.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
        </Animated.View>
      </TouchableOpacity>

      {/* Balance Section */}
      <View style={[styles.balanceSection, { backgroundColor: theme.surface, padding: isMobile ? 10 : 12, marginTop: isMobile ? 10 : 12 }]}>
        <View style={styles.balanceRow}>
          <Text style={[styles.balanceLabel, { color: theme.textMuted, fontSize: isMobile ? 9 : 10 }]}>CREDITS</Text>
          <View style={styles.balanceValue}>
            <Image source={ZEROPROMPT_LOGO} style={{width: isMobile ? 14 : 16, height: isMobile ? 14 : 16}} resizeMode="contain" />
            <Text style={[styles.balanceAmount, { color: currentBalance > 0 ? theme.success : theme.warning, fontSize: isMobile ? 14 : 16 }]}>
              ${currentBalance?.toFixed(4) || '0.0000'}
            </Text>
          </View>
        </View>
        <View style={[styles.creditButtonsRow, { marginTop: isMobile ? 8 : 10 }]}>
          <TouchableOpacity style={[styles.addCreditsBtn, { backgroundColor: theme.primary + '15', flex: 1, paddingVertical: isMobile ? 6 : 8 }]} onPress={() => { console.log("[AddCredits] Button pressed! Calling onAddCredits..."); onAddCredits(); }}>
            <Wallet size={isMobile ? 10 : 12} color={theme.primary} />
            <Text style={[styles.addCreditsText, { color: theme.primary, fontSize: isMobile ? 9 : 10 }]}>ADD CREDITS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Expandable Section with collapse animation */}
      <Animated.View
        style={{
          maxHeight: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 150] }),
          overflow: 'hidden',
          opacity: expandAnim
        }}
      >
        <View style={[styles.expandedContent, { borderTopColor: theme.border, paddingTop: isMobile ? 8 : 12, marginTop: isMobile ? 8 : 12 }]}>
          <TouchableOpacity
            style={[styles.menuItem, { paddingVertical: isMobile ? 10 : 10 }]}
            onPress={() => {
              if (Platform.OS === 'web' && user?.walletAddress) {
                navigator.clipboard.writeText(user.walletAddress);
              }
            }}
          >
            <Copy size={isMobile ? 14 : 14} color={theme.textSecondary} />
            <Text style={[styles.menuItemText, { color: theme.text, fontSize: isMobile ? 12 : 12 }]}>Copy Address</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { paddingVertical: isMobile ? 10 : 10 }]}
            onPress={() => {
              if (Platform.OS === 'web' && user?.walletAddress) {
                window.open(`https://snowtrace.io/address/${user.walletAddress}`, '_blank');
              }
            }}
          >
            <ExternalLink size={isMobile ? 14 : 14} color={theme.textSecondary} />
            <Text style={[styles.menuItemText, { color: theme.text, fontSize: isMobile ? 12 : 12 }]}>View on Explorer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, { paddingVertical: isMobile ? 10 : 10 }]} onPress={onLogout}>
            <LogOut size={isMobile ? 14 : 14} color="#ff4444" />
            <Text style={[styles.menuItemText, { color: '#ff4444', fontSize: isMobile ? 12 : 12 }]}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

// Migration Success Toast/Banner
interface MigrationBannerProps {
  count: number;
  theme: any;
  onDismiss: () => void;
}

export const MigrationBanner = ({ count, theme, onDismiss }: MigrationBannerProps) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
  }, []);

  const dismiss = () => {
    Animated.timing(slideAnim, { toValue: -100, duration: 200, useNativeDriver: true }).start(onDismiss);
  };

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: theme.success,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <Sparkles size={20} color="#fff" />
      <Text style={styles.bannerText}>
        {count} conversation{count > 1 ? 's' : ''} synced to your wallet!
      </Text>
      <TouchableOpacity onPress={dismiss}>
        <X size={18} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)'
  },
  modalContainer: {
    width: Platform.OS === 'web' ? 420 : '92%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    overflow: 'hidden'
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  contentCenter: {
    alignItems: 'center',
    paddingTop: 20
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FONT_MONO,
    marginTop: 20,
    letterSpacing: 1
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 20
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24
  },
  loadingText: {
    fontSize: 13,
    fontFamily: FONT_MONO
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginTop: 20,
    borderWidth: 1
  },
  securityText: {
    fontSize: 11,
    flex: 1
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center'
  },
  migrationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    borderWidth: 1,
    width: '100%'
  },
  migrationCount: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONT_MONO
  },
  migrationLabel: {
    fontSize: 11,
    marginTop: 2
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 24,
    width: '100%'
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONT_MONO
  },
  // Sidebar styles
  sidebarCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 10,
    overflow: 'hidden'
  },
  guestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  guestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  guestTitle: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT_MONO,
    letterSpacing: 1
  },
  guestSub: {
    fontSize: 10,
    fontFamily: FONT_MONO,
    marginTop: 2
  },
  divider: {
    height: 1,
    marginVertical: 16
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12
  },
  connectBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONT_MONO
  },
  buyWithCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.1)'
  },
  buyWithCardText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONT_MONO
  },
  benefitsList: {
    marginTop: 16,
    gap: 8
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  benefitText: {
    fontSize: 11
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  walletAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#000'
  },
  walletLabel: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT_MONO,
    letterSpacing: 1
  },
  walletAddress: {
    fontSize: 10,
    fontFamily: FONT_MONO,
    marginTop: 2
  },
  balanceSection: {
    padding: 12,
    borderRadius: 10,
    marginTop: 12
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  balanceLabel: {
    fontSize: 10,
    fontFamily: FONT_MONO
  },
  balanceValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONT_MONO
  },
  creditButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  addCreditsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6
  },
  addCreditsText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONT_MONO
  },
  expandedContent: {
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10
  },
  menuItemText: {
    fontSize: 12,
    fontFamily: FONT_MONO
  },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    zIndex: 9999
  },
  bannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1
  }
});

export default {
  WalletConnectModal,
  WalletSidebarSection,
  MigrationBanner
};
