export enum dispatcher {
    dealCheckMesssengerConfirmed = "DEAL_CHECK_MESSENGER_CONFIRMED",
}

interface IDispatcherAction {
    url: string;
    params?: object;
}

export interface IDA_dealCheckMesssengerConfirmed extends IDispatcherAction {
    type: dispatcher.dealCheckMesssengerConfirmed;
    action: {
        textOnNewMessenger?: string;
        dealStatusAfter?: string;
    };
}
