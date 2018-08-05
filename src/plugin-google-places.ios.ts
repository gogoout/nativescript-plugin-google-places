import {ContentView} from 'tns-core-modules/ui/content-view';
import * as utils from "tns-core-modules/utils/utils";
import {topmost} from "tns-core-modules/ui/frame";
import {Page} from "tns-core-modules/ui/page"

import {Place, Location, Viewport} from './index';
import * as Common from './plugin-google-places.common';

declare class GMSPlace extends NSObject {
    public name: any;
    public placeID: any;
    public formattedAddress: any;
    public attributions: any;
    public types: any;
    public coordinate: any;
    public viewport?: any;
    public addressComponents?: NSArray<{ type: string, name: string }>
};

declare class GMSPlacesClient extends NSObject {
    static provideAPIKey(key: string): void;

    static sharedClient(): GMSPlacesClient;

    lookUpPlaceIDCallback(id: string, callback: (place: GMSPlace, error) => void): void;
};

declare var GMSServices: any;

export function init(): void {
    GMSPlacesClient.provideAPIKey("__API_KEY__");
    GMSServices.provideAPIKey("__API_KEY__");
}

export function pickPlace(viewport?: Viewport): Promise<Place> {
    return PlacePicker.Instance.pickPlace(viewport);
}


export function getPlacesById(ids: string[]): Promise<Place[]> {
    return new Promise<Place[]>((resolve, reject) => {
        let client: GMSPlacesClient = GMSPlacesClient.sharedClient();

        let places: Place[] = [];

        let getPlacesRecursive = () => {
            if (ids.length === 0) {
                resolve(places);
            } else {
                client.lookUpPlaceIDCallback(ids.shift(), (place: GMSPlace, error) => {
                    if (!place) {
                        reject(error);
                    } else {
                        places.push(placeTransformer(place));
                    }

                    getPlacesRecursive();
                });
            }
        }

        getPlacesRecursive();
    });
}

export function getStaticMapUrl(place: Place, options: { width: number, height: number }): string {
    return Common.getStaticMapUrl(place, options);
}

function placeTransformer(place: GMSPlace): Place {
    const result: Place = {
        name: place.name,
        id: place.placeID,
        address: place.formattedAddress,
        attributions: place.attributions,
        types: utils.ios.collections.nsArrayToJSArray(place.types),
        coordinates: {
            latitude: place.coordinate.latitude,
            longitude: place.coordinate.longitude
        }
    };
    if (place.viewport) {
        result.viewport = {
            northEast: {
                latitude: place.viewport.northEast.latitude,
                longitude: place.viewport.northEast.longitude
            },
            southWest: {
                latitude: place.viewport.southWest.latitude,
                longitude: place.viewport.southWest.longitude
            }
        }
    }
    if (place.addressComponents) {
        result.addressComponents = {};
        const addressComponentsArr: any[] = utils.ios.collections.nsArrayToJSArray(place.addressComponents);
        addressComponentsArr.forEach(addresscomponent => result.addressComponents[addresscomponent.type] = addresscomponent.name);
    }
    return result;
}

declare class GMSPlacePickerViewControllerDelegate extends NSObject {};

declare class GMSPlacePickerViewController extends UIViewController {
    public static alloc(): GMSPlacePickerViewController;

    public initWithConfig(config: GMSPlacePickerConfig): GMSPlacePickerViewController;

    public delegate: GMSPlacePickerViewControllerDelegate;
};


declare class GMSCoordinateBounds extends NSObject {
    public static alloc(): GMSCoordinateBounds;

    public initWithCoordinateCoordinate(...params: any[]): GMSCoordinateBounds;

    public initWithRegion(...params: any[]): GMSCoordinateBounds;

    public northEast: CLLocationCoordinate2D;
    public southWest: CLLocationCoordinate2D;
    public valid: boolean;
};

declare class GMSPlacePickerConfig extends NSObject {
    public static alloc(): GMSPlacePickerConfig;

    public initWithViewport(viewport: GMSCoordinateBounds): GMSPlacePickerConfig;

    public viewport: GMSCoordinateBounds;
}


class PlacePicker extends NSObject implements GMSPlacePickerViewControllerDelegate {

    private static _instance: PlacePicker;
    private static _providedKeys: boolean = false;

    private constructor() { super(); }

    public static ObjCProtocols = [GMSPlacePickerViewControllerDelegate];

    private resolve: (place: Place) => void;
    private reject: (error) => void;
    private placePickerViewController: GMSPlacePickerViewController;

    static get Instance(): PlacePicker {
        if (!this._instance) {
            this._instance = PlacePicker.new();
            this._instance.initialize();
        }
        return this._instance;
    }

    private get currentViewController(): any {
        const topView = topmost();
        return (topView.currentPage.modal || topView).viewController;
    }

    public pickPlace(viewport?: Viewport): Promise<Place> {

        let bounds: GMSCoordinateBounds = null;

        if (viewport) {
            let northEast = new CLLocationCoordinate2D();
            northEast.latitude = viewport.northEast.latitude;
            northEast.longitude = viewport.northEast.longitude;

            let southWest = new CLLocationCoordinate2D();
            southWest.latitude = viewport.southWest.latitude;
            southWest.longitude = viewport.southWest.longitude;

            bounds = GMSCoordinateBounds.alloc().initWithCoordinateCoordinate(southWest, northEast);
        }

        let config: GMSPlacePickerConfig = GMSPlacePickerConfig.alloc().initWithViewport(bounds);

        this.placePickerViewController.initWithConfig(config);

        this.currentViewController.presentViewControllerAnimatedCompletion(this.placePickerViewController, true, null);


        return new Promise<Place>((resolve, reject) => {
            this.setPromise(resolve, reject);
        });
    }

    private initialize(): void {
        this.placePickerViewController = GMSPlacePickerViewController.alloc().initWithConfig(null);
        this.placePickerViewController.delegate = this;
    }

    static new(): PlacePicker {
        return <PlacePicker>super.new();
    }

    public placePickerDidPickPlace(placePicker: GMSPlacePickerViewController, place: GMSPlace): void {
        this.destroyPlacePicker();
        if (this.resolve) {
            this.resolve(placeTransformer(place));
        }
    }

    public placePickerDidFailWithError(placePicker: GMSPlacePickerViewController, error: NSError): void {
        this.destroyPlacePicker();
        if (this.reject) {
            this.reject(error);
        }
    }

    public placePickerDidCancel(placePicker: GMSPlacePickerViewController): void {
        this.destroyPlacePicker();
        if (this.resolve) {
            this.resolve(null);
        }
    }

    private setPromise(resolve: (place: Place) => void, reject: (error) => void) {
        this.resolve = resolve;
        this.reject = reject;
    }

    private destroyPlacePicker(): void {
        this.currentViewController.dismissViewControllerAnimatedCompletion(true, null);
        PlacePicker._instance = null;
    }
}
