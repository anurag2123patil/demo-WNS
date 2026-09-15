import { useState, useCallback } from 'react';
// import CustomAlert, { AlertType } from '@/src/components/CustomAlert';
import CustomAlert, { AlertType } from '@/components/CustomAlert';
import React from 'react';
interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type: AlertType;
  buttons?: {
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }[];
}

export const useAlert = () => {
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = useCallback((
    title: string,
    message: string,
    type: AlertType = 'info',
    buttons?: AlertState['buttons']
  ) => {
    setAlertState({
      visible: true,
      title,
      message,
      type,
      buttons,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, visible: false }));
  }, []);

  const AlertComponent = () => (
    <CustomAlert
      visible={alertState.visible}
      title={alertState.title}
      message={alertState.message}
      type={alertState.type}
      onClose={hideAlert}
      buttons={alertState.buttons}
    />
  );

  return {
    showAlert,
    hideAlert,
    AlertComponent,
  };
};