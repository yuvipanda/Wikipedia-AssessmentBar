from flask import Flask, redirect
from random import choice
from datetime import datetime
import os.path

DIR = os.path.dirname(__file__)

allTitles = {}

app = Flask(__name__)
app.debug = True

def urlForTitle(title):
    return "//en.wikipedia.org/wiki/" + title

def getTitles(cat):
    def updateTitles():
        f = open(os.path.join(DIR, cat))
        allTitles[cat] = {
                "lastupdate": datetime.now(),
                "titles": [l.strip() for l in f.readlines()]
                }

    if cat not in allTitles:
        updateTitles()

    return allTitles[cat]['titles']

@app.route('/r/<cat>/')
def randomTitle(cat):
   titles = getTitles(cat)
   return redirect(urlForTitle(choice(titles)))

if __name__ == '__main__':
    app.run()
