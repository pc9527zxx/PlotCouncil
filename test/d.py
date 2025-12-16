import matplotlib.pyplot as plt
import numpy as np
import matplotlib.ticker as ticker

def create_scientific_plot():
    # 1. Setup Figure and Axes
    fig, ax1 = plt.subplots(figsize=(6, 5.5), facecolor='white')
    
    # Adjust margins
    plt.subplots_adjust(left=0.15, right=0.85, top=0.9, bottom=0.15)

    # 2. Generate Synthetic Data
    
    # Series 1: Shear Stress (Red Squares) - Power law decay
    # Model: y = A * x^(-2)
    # Fit roughly through (1, 0.6) -> 0.6 = A * 1 -> A = 0.6
    x_shear = np.array([1.0, 2.0, 4.0, 6.0, 20.0])
    # Add slight noise to make it look experimental
    y_shear = 0.6 * (x_shear ** -2.0) * np.array([1.0, 1.05, 1.1, 1.0, 1.1]) 
    
    # Theoretical line for Shear Stress
    x_theory = np.logspace(np.log10(1.0), np.log10(20.0), 50)
    y_theory = 0.6 * (x_theory ** -2.0)

    # Series 2: Relative Flow Velocity (Blue Circles) - Sigmoidal
    # Create x values logarithmically spaced
    x_flow = np.logspace(np.log10(0.6), np.log10(40), 18)
    
    # Create a sigmoid function: L / (1 + exp(-k(x-x0)))
    # Visual estimation: transition around x=15, steepness moderate
    # But the plot shows a complex shape: flat low, then rise, then plateau
    # Let's construct it piecewise or with interpolation to match visual closely
    x_flow_control = [0.6, 2, 5, 8, 12, 15, 18, 22, 30, 40]
    y_flow_control = [0.02, 0.03, 0.08, 0.15, 0.28, 0.45, 0.75, 0.78, 0.82, 0.85]
    # Interpolate to get the specific points used in the plot
    y_flow = np.interp(x_flow, x_flow_control, y_flow_control)
    # Add some specific adjustments to match the "bumps" in the image
    # The image has a dip/flat region around x=10
    
    # Let's just manually approximate the visual distribution for better fidelity
    x_flow = np.array([0.6, 0.8, 1.0, 1.2, 1.5, 1.8, 2.2, 2.8, 3.5, 4.5, 5.5, 7.0, 9.0, 11.0, 14.0, 18.0, 22.0, 28.0, 38.0])
    y_flow = np.array([0.01, 0.01, 0.015, 0.02, 0.03, 0.025, 0.04, 0.05, 0.06, 0.08, 0.07, 0.12, 0.15, 0.28, 0.29, 0.55, 0.75, 0.78, 0.85])

    # 3. Plotting on Left Axis (Shear Stress)
    ax1.set_xscale('log')
    ax1.set_yscale('log')
    
    # Theoretical line
    ax1.plot(x_theory, y_theory, color='black', linewidth=1.2, zorder=1)
    
    # Data points
    ax1.scatter(x_shear, y_shear, s=60, marker='s', facecolor='red', edgecolor='black', linewidth=1.0, zorder=2, label='Shear Stress')

    # Axis Limits and Ticks (Left)
    ax1.set_xlim(0.5, 50)
    ax1.set_ylim(0.001, 1.0)
    
    # Custom X Ticks
    major_ticks_x = [0.5, 1, 2, 5, 10, 20, 50]
    ax1.set_xticks(major_ticks_x)
    ax1.get_xaxis().set_major_formatter(ticker.ScalarFormatter())
    ax1.set_xticklabels([str(x) for x in major_ticks_x])
    
    # Labels
    ax1.set_xlabel('lumen width (μm)', fontsize=12, fontfamily='sans-serif')
    ax1.set_ylabel('shear stress (Pa)', fontsize=12, fontfamily='sans-serif')
    
    # 4. Plotting on Right Axis (Flow Velocity)
    ax2 = ax1.twinx()
    ax2.set_ylim(0, 1.0)
    
    # Plot connected scatter
    ax2.plot(x_flow, y_flow, color='blue', linewidth=1.2, zorder=3)
    ax2.scatter(x_flow, y_flow, s=50, marker='o', facecolor='blue', edgecolor='black', linewidth=1.0, zorder=4)
    
    # Labels
    ax2.set_ylabel('relative flow velocity', fontsize=12, fontfamily='sans-serif')
    
    # Ticks
    ax2.set_yticks(np.arange(0, 1.1, 0.1))
    
    # 5. Annotations and Styling
    
    # Vertical dashed line at b = 1.1
    ax1.axvline(x=1.1, color='black', linestyle='--', linewidth=1.0, ymax=0.9) # ymax in axes fraction
    
    # Horizontal dashed line at tau = 0.5
    ax1.axhline(y=0.5, color='black', linestyle='--', linewidth=1.0, xmin=0.0, xmax=1.0)
    
    # Text Annotations
    # "D"
    ax1.text(-0.15, 1.0, 'D', transform=ax1.transAxes, fontsize=16, fontweight='bold', va='top', ha='left')
    
    # "b = 1.1 μm"
    ax1.text(1.25, 0.0015, 'b = 1.1 μm', rotation=90, fontsize=10, va='bottom')
    
    # "tau = 0.5 Pa"
    ax1.text(5, 0.55, r'$\tau$ = 0.5 Pa', fontsize=10)
    
    # Equation
    ax1.text(5, 0.04, r'$\tau = \frac{4\mu Q}{\pi ab^2}$', fontsize=12)

    # Tick styling
    ax1.tick_params(axis='both', which='both', direction='in', top=False, right=False)
    ax2.tick_params(axis='y', direction='in')
    
    # Ensure minor ticks on log axes
    ax1.yaxis.set_minor_locator(ticker.LogLocator(base=10.0, subs='auto', numticks=12))
    ax1.xaxis.set_minor_locator(ticker.LogLocator(base=10.0, subs=np.arange(1,10)*0.1, numticks=12)) # Custom minor ticks for x if needed, but standard usually works
    
    # Fix minor ticks for X (since we used scalar formatter on major)
    # The image shows minor ticks between the custom majors. 
    # Matplotlib's default log minor locator should handle this, but let's ensure visibility
    ax1.tick_params(which='minor', length=3)
    ax1.tick_params(which='major', length=6)

    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    create_scientific_plot()