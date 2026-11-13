#include <iostream>
#include <string>
#include <algorithm>

using namespace std;

// Paverčia tekstą į mažąsias raides
string toLowerCase(string text) {
    transform(text.begin(), text.end(), text.begin(), ::tolower);
    return text;
}

// Taisyklėmis grįstas atsakymų generatorius
string getResponse(const string& input) {
    string text = toLowerCase(input);
    if (text.find("labas") != string::npos || text.find("sveiki") != string::npos) {
        return "Labas! Kaip galiu padeti?";
    }
    else if (text.find("vardas") != string::npos) {
        return "As esu paprastas pokalbiu robotas, parasytas C++ kalba.";
    }
    else if (text.find("kaip sekasi") != string::npos) {
        return "Man sekasi gerai. O kaip tau?";
    }
    else if (text.find("viso") != string::npos || text.find("ate") != string::npos) {
        return "Iki! Geros dienos.";
    }
    else if (text.find("pagalba") != string::npos) {
        return "Gali parasytisveikinima, paklausti mano vardo arba kaip man sekasi.";
    }
    else {
        return "Atsiprasau, nesupratau. Pabandyk perfrazuoti.";
    }
}

int main() {
    string userInput;
    cout << "Paprastas C++ pokalbiu robotas" << endl;
    cout << "Parasyk zinute. Isejimui rasyk 'viso' arba 'ate'." << endl;
    while (true) {
        cout << "\nTu: ";
        getline(cin, userInput);
        string lowerInput = toLowerCase(userInput);
        string response = getResponse(userInput);
        cout << "Robotas: " << response << endl;
        if (lowerInput.find("viso") != string::npos || lowerInput.find("ate") != string::npos) {
            break;
        }
    }
    return 0;
}
