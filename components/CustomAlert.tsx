import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
// import { useTheme } from '../../src/theme/ThemeProvider';
import { useTheme } from '@/contexts/ThemeContext';
export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: AlertType;
  onClose: () => void;
  buttons?: {
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }[];
}

const { width } = Dimensions.get('window');

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  type = 'info',
  onClose,
  buttons = [{ text: 'OK', onPress: onClose }],
}) => {
  const { theme } = useTheme();

  const alertConfig = {
    success: {
      icon: CheckCircle,
      iconColor: '#10B981',
    },
    error: {
      icon: AlertCircle,
      iconColor: '#EF4444',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: '#F59E0B',
    },
    info: {
      icon: Info,
      iconColor: '#3B82F6',
    },
  };

  const config = alertConfig[type] || alertConfig.info;
  const IconComponent = config.icon;


  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.alertContainer,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            }
          ]}
        >
          {/* Header - Removed close button */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <IconComponent size={24} color={config.iconColor} />
              <Text style={[styles.title, { color: theme.text }]}>
                {title}
              </Text>
            </View>
            {/* <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity> */}
          </View>

          {/* Message */}
          <View style={styles.content}>
            <Text style={[styles.message, { color: theme.text }]}>
              {message}
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  button.style === 'destructive' && { backgroundColor: '#FEF2F2' },
                  button.style === 'cancel' && { backgroundColor: 'transparent' },
                ]}
                onPress={() => {
                  button.onPress();
                  onClose();
                }}
              >
                <Text style={[
                  styles.buttonText,
                  {
                    color: button.style === 'destructive'
                      ? '#EF4444'
                      : button.style === 'cancel'
                        ? theme.textMuted
                        : theme.primary
                  }
                ]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertContainer: {
    width: width * 0.85,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 8,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 32, // Align with icon
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default CustomAlert;